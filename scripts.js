window.tailwind = window.tailwind || {};
window.tailwind.config = {
      theme: {
        extend: {
          colors: {
            'mekong-blue': '#2a5ea9',
            'mekong-light-blue': '#eaf2fb',
            'mekong-sky': '#7ca8ea',
            'mekong-brown': '#6a4b17',
            'mekong-gray': '#5d6775',
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
          },
        }
      }
    };

const TEMPERATURE_HISTORY_URLS = [
  window.__TEMPERATURE_HISTORY_URL__,
].filter(Boolean);

const TEMP_GRANULARITY_META = {
  second: { label: 'Giây', stepMs: 1000, format: { hour: '2-digit', minute: '2-digit', second: '2-digit' } },
  minute: { label: 'Phút', stepMs: 60000, format: { hour: '2-digit', minute: '2-digit' } },
  hour: { label: 'Giờ', stepMs: 3600000, format: { hour: '2-digit' } },
};

const DASHBOARD_STORAGE_KEY = 'mekongstem.smart-home.dashboard-state-v1';

const getEmptyStoredDashboardState = () => ({
  controls: {},
  sensors: {},
  alerts: [],
  chart: {},
  ui: {},
});

const normalizeStoredDashboardState = (state) => {
  const fallback = getEmptyStoredDashboardState();
  if (!state || typeof state !== 'object') return fallback;

  const controls = state.controls && typeof state.controls === 'object' ? state.controls : {};
  const sensors = state.sensors && typeof state.sensors === 'object' ? state.sensors : {};
  const chart = state.chart && typeof state.chart === 'object' ? state.chart : {};
  const ui = state.ui && typeof state.ui === 'object' ? state.ui : {};
  const alerts = Array.isArray(state.alerts)
    ? state.alerts.slice(0, 10).map((alert) => ({
      title: String(alert?.title || 'Cảnh báo'),
      location: String(alert?.location || ''),
      time: String(alert?.time || ''),
      icon: String(alert?.icon || 'fa-bell'),
      iconClass: String(alert?.iconClass || 'bg-mekong-light-blue text-mekong-blue'),
      timeClass: String(alert?.timeClass || 'text-mekong-brown'),
    }))
    : [];

  return {
    ...fallback,
    ...state,
    controls,
    sensors,
    alerts,
    chart,
    ui,
  };
};

let dashboardStorageCache = null;

const readDashboardState = () => {
  if (dashboardStorageCache) return dashboardStorageCache;

  try {
    const raw = window.localStorage.getItem(DASHBOARD_STORAGE_KEY);
    dashboardStorageCache = normalizeStoredDashboardState(raw ? JSON.parse(raw) : null);
  } catch (error) {
    dashboardStorageCache = getEmptyStoredDashboardState();
  }

  return dashboardStorageCache;
};

const writeDashboardState = (patch = {}) => {
  const current = readDashboardState();
  const next = normalizeStoredDashboardState({
    ...current,
    ...patch,
    controls: {
      ...current.controls,
      ...(patch.controls || {}),
    },
    sensors: {
      ...current.sensors,
      ...(patch.sensors || {}),
    },
    alerts: Array.isArray(patch.alerts) ? patch.alerts : current.alerts,
    chart: {
      ...current.chart,
      ...(patch.chart || {}),
    },
    ui: {
      ...current.ui,
      ...(patch.ui || {}),
    },
  });

  dashboardStorageCache = next;

  try {
    window.localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    // Ignore storage write failures and keep the in-memory cache.
  }

  return next;
};

document.addEventListener('DOMContentLoaded', function() {
  const canvas = document.getElementById('tempChart');
  const subtitle = document.getElementById('temperatureChartSubtitle');
  const prevDayBtn = document.getElementById('temperatureChartPrevDay');
  const todayBtn = document.getElementById('temperatureChartToday');
  const nextDayBtn = document.getElementById('temperatureChartNextDay');
  const granularitySelect = document.getElementById('temperatureChartGranularity');
  if (!canvas || !subtitle || !prevDayBtn || !todayBtn || !nextDayBtn || !granularitySelect) return;

  const ctx = canvas.getContext('2d');
  const storedChartState = readDashboardState().chart || {};
  const storedChartSeries = Array.isArray(storedChartState.series) ? storedChartState.series : [];
  const storedSelectedDate = storedChartState.selectedDate ? new Date(storedChartState.selectedDate) : null;
  const chartState = {
    selectedDate: storedSelectedDate && !Number.isNaN(storedSelectedDate.getTime()) ? storedSelectedDate : new Date(),
    granularity: storedChartState.granularity || granularitySelect.value || 'minute',
    series: storedChartSeries
      .map((item) => {
        const timestamp = item?.timestamp ? new Date(item.timestamp) : null;
        const value = typeof item?.value === 'number' ? item.value : Number(item?.value);
        if (!Number.isFinite(value) || !timestamp || Number.isNaN(timestamp.getTime())) return null;
        return {
          value,
          timestamp,
          label: item.label || '',
        };
      })
      .filter(Boolean),
    loading: false,
    error: '',
    resizeObserver: null,
  };

  const pad = (value) => String(value).padStart(2, '0');
  const formatLocalDateKey = (date) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };
  const formatDisplayDate = (date) => new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
  const formatDisplayTime = (date, granularity) => new Intl.DateTimeFormat('vi-VN', TEMP_GRANULARITY_META[granularity]?.format || TEMP_GRANULARITY_META.minute.format).format(date);
  const cloneDate = (date) => new Date(date.getTime());
  const shiftDate = (date, deltaDays) => {
    const next = cloneDate(date);
    next.setDate(next.getDate() + deltaDays);
    return next;
  };
  const parseDateValue = (value) => {
    if (value instanceof Date) return new Date(value.getTime());
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const parseTemperatureValue = (value) => {
    if (value == null) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number.parseFloat(value.replace(',', '.').replace(/[^\d.-]/g, ''));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };
  const formatTemperatureNumber = (value, maximumFractionDigits = 1) => new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits,
  }).format(value);
  const pickTimestamp = (item) => {
    if (!item || typeof item !== 'object') return null;
    return item.timestamp ?? item.time ?? item.createdAt ?? item.date ?? item.datetime ?? item.recordedAt ?? item.ts ?? null;
  };
  const extractRawArray = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    return payload.points || payload.items || payload.data || payload.series || payload.readings || payload.temperatures || [];
  };
  const buildSyntheticSeries = (values, granularity, selectedDate) => {
    const meta = TEMP_GRANULARITY_META[granularity] || TEMP_GRANULARITY_META.minute;
    const start = new Date(selectedDate);
    start.setHours(0, 0, 0, 0);
    return values
      .map((value, index) => {
        const numericValue = parseTemperatureValue(value);
        if (numericValue === null) return null;
        const timestamp = new Date(start.getTime() + index * meta.stepMs);
        return {
          value: numericValue,
          timestamp,
          label: formatDisplayTime(timestamp, granularity),
        };
      })
      .filter(Boolean);
  };
  const normalizeTemperatureSeries = (payload, granularity, selectedDate) => {
    const rawItems = extractRawArray(payload);
    if (!rawItems.length) return [];

    const bucketMap = new Map();
    let hasTimestamp = false;

    rawItems.forEach((item, index) => {
      const numericValue = typeof item === 'number'
        ? item
        : parseTemperatureValue(item?.value ?? item?.temperature ?? item?.temp ?? item);

      if (numericValue === null) return;

      const timestampValue = parseDateValue(pickTimestamp(item));
      if (timestampValue) {
        hasTimestamp = true;
        const bucket = new Date(timestampValue);
        if (granularity === 'hour') {
          bucket.setMinutes(0, 0, 0);
        } else if (granularity === 'minute') {
          bucket.setSeconds(0, 0);
        } else {
          bucket.setMilliseconds(0);
        }

        const bucketKey = bucket.toISOString();
        const current = bucketMap.get(bucketKey) || { value: 0, count: 0, timestamp: bucket };
        current.value += numericValue;
        current.count += 1;
        bucketMap.set(bucketKey, current);
        return;
      }

      const synthetic = buildSyntheticSeries([numericValue], granularity, selectedDate)[0];
      if (synthetic) {
        const bucketKey = `${selectedDate.toDateString()}-${index}`;
        bucketMap.set(bucketKey, {
          value: synthetic.value,
          count: 1,
          timestamp: synthetic.timestamp,
        });
      }
    });

    const aggregated = Array.from(bucketMap.values()).map((item) => {
      const timestamp = item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp);
      const value = item.value / item.count;
      return {
        value,
        timestamp,
        label: formatDisplayTime(timestamp, granularity),
      };
    });

    if (hasTimestamp) {
      aggregated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      return aggregated;
    }

    if (aggregated.length) {
      return aggregated;
    }

    return buildSyntheticSeries(rawItems, granularity, selectedDate);
  };
  const setSubtitle = () => {
    const granularityMeta = TEMP_GRANULARITY_META[chartState.granularity] || TEMP_GRANULARITY_META.minute;
    subtitle.textContent = `${formatDisplayDate(chartState.selectedDate)} · Xem theo ${granularityMeta.label.toLowerCase()}`;
  };
  const persistChartState = () => {
    writeDashboardState({
      chart: {
        selectedDate: chartState.selectedDate.toISOString(),
        granularity: chartState.granularity,
        series: chartState.series.map((item) => ({
          value: item.value,
          timestamp: item.timestamp instanceof Date ? item.timestamp.toISOString() : item.timestamp,
          label: item.label || '',
        })),
      },
    });
  };
  const resizeCanvas = () => {
    const parent = canvas.parentElement;
    const width = Math.max(320, parent?.clientWidth || canvas.clientWidth || canvas.offsetWidth || 320);
    const height = 200;
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width, height };
  };
  const drawEmptyState = (message) => {
    const { width, height } = resizeCanvas();
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#5d6775';
    ctx.font = '14px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(message, width / 2, height / 2);
  };
  const drawChart = (series) => {
    const { width, height } = resizeCanvas();
    ctx.clearRect(0, 0, width, height);

    if (!series.length) {
      drawEmptyState(chartState.error || 'Chưa có dữ liệu nhiệt độ cho khoảng thời gian này.');
      return;
    }

    const padding = 42;
    const chartWidth = Math.max(1, width - padding * 2);
    const chartHeight = Math.max(1, height - padding * 2);
    const values = series.map((item) => item.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const rangePadding = Math.max(1, (maxValue - minValue) * 0.2);
    const minY = minValue - rangePadding;
    const maxY = maxValue + rangePadding;
    const yScale = (value) => {
      if (maxY === minY) return padding + chartHeight / 2;
      return padding + chartHeight - ((value - minY) / (maxY - minY)) * chartHeight;
    };
    const xScale = (index) => {
      if (series.length === 1) return padding + chartWidth / 2;
      return padding + (chartWidth / (series.length - 1)) * index;
    };

    ctx.strokeStyle = '#dfe9f7';
    ctx.fillStyle = '#5d6775';
    ctx.lineWidth = 1;
    ctx.font = '10px Inter';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 4; i += 1) {
      const y = padding + (chartHeight / 4) * i;
      const value = maxY - ((maxY - minY) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(width - padding, y);
      ctx.stroke();
      ctx.fillText(`${formatTemperatureNumber(value)}°C`, padding - 6, y + 3);
    }

    ctx.textAlign = 'center';
    const xLabelStep = Math.max(1, Math.ceil(series.length / 6));
    series.forEach((item, index) => {
      if (index % xLabelStep !== 0 && index !== series.length - 1) return;
      const x = xScale(index);
      ctx.fillText(item.label || '', x, height - 10);
    });

    ctx.beginPath();
    ctx.moveTo(xScale(0), height - padding);
    series.forEach((item, index) => {
      ctx.lineTo(xScale(index), yScale(item.value));
    });
    ctx.lineTo(xScale(series.length - 1), height - padding);
    ctx.closePath();
    ctx.fillStyle = 'rgba(42, 94, 169, 0.12)';
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#2a5ea9';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    series.forEach((item, index) => {
      const x = xScale(index);
      const y = yScale(item.value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    series.forEach((item, index) => {
      const x = xScale(index);
      const y = yScale(item.value);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#2a5ea9';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    const lastPoint = series[series.length - 1];
    const lastX = xScale(series.length - 1);
    const lastY = yScale(lastPoint.value);
    const labelText = `${formatTemperatureNumber(lastPoint.value)}°C`;
    ctx.font = 'bold 10px Inter';
    const labelWidth = ctx.measureText(labelText).width + 12;
    const labelX = Math.min(Math.max(6, lastX - labelWidth / 2), width - labelWidth - 6);
    const labelY = Math.max(6, lastY - 28);
    ctx.fillStyle = '#2a5ea9';
    ctx.fillRect(labelX, labelY, labelWidth, 18);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(labelText, labelX + labelWidth / 2, labelY + 12);
  };
  const renderTemperatureChart = () => {
    setSubtitle();
    drawChart(chartState.series);
  };
  const updateNavigationState = () => {
    const todayKey = formatLocalDateKey(new Date());
    const selectedKey = formatLocalDateKey(chartState.selectedDate);
    todayBtn.disabled = selectedKey === todayKey;
    nextDayBtn.disabled = selectedKey === todayKey;
    nextDayBtn.classList.toggle('opacity-50', nextDayBtn.disabled);
    nextDayBtn.classList.toggle('cursor-not-allowed', nextDayBtn.disabled);
    todayBtn.classList.toggle('opacity-50', todayBtn.disabled);
    todayBtn.classList.toggle('cursor-not-allowed', todayBtn.disabled);
  };
  const setLoadingState = (isLoading) => {
    chartState.loading = isLoading;
    if (isLoading) {
      subtitle.textContent = TEMPERATURE_HISTORY_URLS.length
        ? 'Đang tải dữ liệu nhiệt độ từ server...'
        : 'Đang hiển thị dữ liệu nhiệt độ đã lưu.';
    }
  };
  const resolveTemperatureHistory = async (date, granularity) => {
    if (!TEMPERATURE_HISTORY_URLS.length) {
      throw new Error('Temperature history endpoint is not configured');
    }

    const queryDate = formatLocalDateKey(date);
    let lastError = null;

    for (const endpoint of TEMPERATURE_HISTORY_URLS) {
      try {
        const url = new URL(endpoint, window.location.origin);
        url.searchParams.set('date', queryDate);
        url.searchParams.set('granularity', granularity);
        url.searchParams.set('ts', String(Date.now()));

        const response = await fetch(url.toString(), { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const payload = await response.json();
        const series = normalizeTemperatureSeries(payload, granularity, date);
        if (series.length) {
          return series;
        }
        lastError = new Error('Empty series');
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error('Không tải được dữ liệu nhiệt độ');
  };
  const loadTemperatureChart = async () => {
    chartState.granularity = granularitySelect.value || 'minute';
    updateNavigationState();

    if (!TEMPERATURE_HISTORY_URLS.length) {
      chartState.error = chartState.series.length
        ? ''
        : 'Chưa có dữ liệu nhiệt độ đã lưu.';
      renderTemperatureChart();
      persistChartState();
      return;
    }

    setLoadingState(true);

    try {
      const series = await resolveTemperatureHistory(chartState.selectedDate, chartState.granularity);
      chartState.series = series;
      chartState.error = '';
    } catch (error) {
      chartState.error = chartState.series.length
        ? 'Không tải được dữ liệu nhiệt độ từ server. Đang hiển thị dữ liệu đã lưu.'
        : 'Không tải được dữ liệu nhiệt độ từ server.';
      console.warn('Không tải được lịch sử nhiệt độ:', error.message);
    } finally {
      setLoadingState(false);
      renderTemperatureChart();
      persistChartState();
    }
  };

  const appendLiveTemperaturePoint = (value, timestamp = new Date()) => {
    const numericValue = parseTemperatureValue(value);
    const pointTime = parseDateValue(timestamp) || new Date();
    if (numericValue === null) return;
    if (formatLocalDateKey(pointTime) !== formatLocalDateKey(chartState.selectedDate)) return;

    const nextSeries = [...chartState.series, {
      value: numericValue,
      timestamp: pointTime,
      label: formatDisplayTime(pointTime, chartState.granularity),
    }];
    chartState.series = nextSeries.slice(-720);
    chartState.error = '';
    renderTemperatureChart();
    persistChartState();
  };

  window.__MEKONG_TEMP_CHART__ = {
    refresh: loadTemperatureChart,
    append: appendLiveTemperaturePoint,
    setDate: (date) => {
      const nextDate = parseDateValue(date);
      if (!nextDate) return;
      chartState.selectedDate = nextDate;
      updateNavigationState();
      loadTemperatureChart();
    },
  };

  prevDayBtn.addEventListener('click', () => {
    chartState.selectedDate = shiftDate(chartState.selectedDate, -1);
    updateNavigationState();
    loadTemperatureChart();
  });

  todayBtn.addEventListener('click', () => {
    chartState.selectedDate = new Date();
    updateNavigationState();
    loadTemperatureChart();
  });

  nextDayBtn.addEventListener('click', () => {
    const today = new Date();
    if (formatLocalDateKey(chartState.selectedDate) === formatLocalDateKey(today)) return;
    chartState.selectedDate = shiftDate(chartState.selectedDate, 1);
    if (formatLocalDateKey(chartState.selectedDate) > formatLocalDateKey(today)) {
      chartState.selectedDate = today;
    }
    updateNavigationState();
    loadTemperatureChart();
  });

  granularitySelect.addEventListener('change', () => {
    chartState.granularity = granularitySelect.value || 'minute';
    loadTemperatureChart();
  });

  if (window.ResizeObserver) {
    chartState.resizeObserver = new ResizeObserver(() => {
      renderTemperatureChart();
    });
    chartState.resizeObserver.observe(canvas.parentElement || canvas);
  } else {
    window.addEventListener('resize', renderTemperatureChart);
  }

  updateNavigationState();
  if (chartState.series.length) {
    renderTemperatureChart();
  }
  loadTemperatureChart();
});

document.addEventListener('DOMContentLoaded', function() {
  const rgbCard = document.getElementById('rgbLedCard');
  const rgbIcon = document.getElementById('rgbLedIcon');
  const rgbStatus = document.getElementById('rgbLedStatus');
  const colorButtons = document.querySelectorAll('.honeycomb-cell');
  const rgbToggle = rgbCard?.querySelector('.toggle-checkbox');
  const fanCard = document.getElementById('fanCard');
  const fanIcon = document.getElementById('fanIcon');
  const fanStatus = document.getElementById('fanStatus');
  const fanToggle = document.getElementById('fanToggle');
  const fanSpeedSlider = document.getElementById('fanSpeedSlider');
  const fanSpeedValue = document.getElementById('fanSpeedValue');
  const fanSettingsButton = document.getElementById('fanSettingsButton');
  const fanSettingsModal = document.getElementById('fanSettingsModal');
  const fanSettingsClose = document.getElementById('fanSettingsClose');
  const fanSettingsCancel = document.getElementById('fanSettingsCancel');
  const fanSettingsOk = document.getElementById('fanSettingsOk');
  const fanScheduleNotice = document.getElementById('fanScheduleNotice');
  const fanScheduleModeFixed = document.getElementById('fanScheduleModeFixed');
  const fanScheduleModeDuration = document.getElementById('fanScheduleModeDuration');
  const fanFixedList = document.getElementById('fanFixedList');
  const fanFixedAdd = document.getElementById('fanFixedAdd');
  const fanFixedAction = document.getElementById('fanFixedAction');
  const fanFixedTime = document.getElementById('fanFixedTime');
  const fanDurationPreset = document.getElementById('fanDurationPreset');
  const fanDurationCustom = document.getElementById('fanDurationCustom');
  const buzzerCard = document.getElementById('buzzerCard');
  const buzzerIcon = document.getElementById('buzzerIcon');
  const buzzerStatus = document.getElementById('buzzerStatus');
  const buzzerToggle = document.getElementById('buzzerToggle');
  const buzzerDetectToggle = document.getElementById('buzzerDetectToggle');
  const mainDoorCard = document.getElementById('mainDoorCard');
  const mainDoorIcon = document.getElementById('mainDoorIcon');
  const mainDoorStatus = document.getElementById('mainDoorStatus');
  const mainDoorToggle = document.getElementById('mainDoorToggle');
  const autoDoorCard = document.getElementById('autoDoorCard');
  const autoDoorIcon = document.getElementById('autoDoorIcon');
  const autoDoorStatus = document.getElementById('autoDoorStatus');
  const autoDoorToggle = document.getElementById('autoDoorToggle');
  const lightControlCard = document.getElementById('lightControlCard');
  const lightControlIcon = document.getElementById('lightControlIcon');
  const lightControlStatus = document.getElementById('lightControlStatus');
  const lightToggle = document.getElementById('lightToggle');
  const favoriteLightToggle = document.getElementById('favoriteLightToggle');
  const autoLightToggle = document.getElementById('autoLightToggle');
  const lightSettingsButton = document.getElementById('lightSettingsButton');
  const lightSettingsModal = document.getElementById('lightSettingsModal');
  const lightSettingsClose = document.getElementById('lightSettingsClose');
  const lightSettingsCancel = document.getElementById('lightSettingsCancel');
  const lightSettingsOk = document.getElementById('lightSettingsOk');
  const lightScheduleNotice = document.getElementById('lightScheduleNotice');
  const lightScheduleModeFixed = document.getElementById('lightScheduleModeFixed');
  const lightScheduleModeDuration = document.getElementById('lightScheduleModeDuration');
  const lightFixedList = document.getElementById('lightFixedList');
  const lightFixedAdd = document.getElementById('lightFixedAdd');
  const lightFixedAction = document.getElementById('lightFixedAction');
  const lightFixedTime = document.getElementById('lightFixedTime');
  const lightDurationPreset = document.getElementById('lightDurationPreset');
  const lightDurationCustom = document.getElementById('lightDurationCustom');
  const motionStatusCard = document.getElementById('motionStatusCard');
  const motionStatusIcon = document.getElementById('motionStatusIcon');
  const motionStatusValue = document.getElementById('motionStatusValue');
  const motionStatusText = document.getElementById('motionStatusText');
  const alertsList = document.getElementById('alertsList');
  const alertCount = document.getElementById('alertCount');
  const temperatureValue = document.getElementById('temperatureValue');
  const temperatureStatus = document.getElementById('temperatureStatus');
  const humidityValue = document.getElementById('humidityValue');
  const humidityStatus = document.getElementById('humidityStatus');
  const lightValue = document.getElementById('lightValue');
  const lightStatus = document.getElementById('lightStatus');
  const gasValue = document.getElementById('gasValue');
  const gasStatus = document.getElementById('gasStatus');
  const mqttConnectionStatus = document.getElementById('mqttConnectionStatus');

  if (!rgbCard || !rgbIcon || !rgbStatus || !colorButtons.length) return;

  const mqttBaseTopic = 'mekongstem/smart-home/esp32s3-luong872';
  const mqttConfig = {
    url: 'wss://broker.emqx.io:8084/mqtt',
    deviceCmdTopic: `${mqttBaseTopic}/cmd/device`,
    rgbStateTopic: `${mqttBaseTopic}/cmd/led-rgb/state`,
    rgbColorTopic: `${mqttBaseTopic}/cmd/led-rgb/color`,
    fanStateTopic: `${mqttBaseTopic}/cmd/fan/state`,
    fanSpeedTopic: `${mqttBaseTopic}/cmd/fan/speed`,
    buzzerStateTopic: `${mqttBaseTopic}/cmd/buzzer/state`,
    buzzerDetectStateTopic: `${mqttBaseTopic}/cmd/buzzer/detect`,
    mainDoorStateTopic: `${mqttBaseTopic}/cmd/door/main`,
    autoDoorStateTopic: `${mqttBaseTopic}/cmd/door/rfid`,
    lightStateTopic: `${mqttBaseTopic}/cmd/light/state`,
    autoLightTopic: `${mqttBaseTopic}/cmd/light/auto`,
    deviceStateTopic: `${mqttBaseTopic}/state/device`,
    motionTopic: `${mqttBaseTopic}/state/motion`,
    rgbStatusTopic: `${mqttBaseTopic}/state/led-rgb`,
    fanStatusTopic: `${mqttBaseTopic}/state/fan`,
    buzzerStatusTopic: `${mqttBaseTopic}/state/buzzer`,
    buzzerDetectStatusTopic: `${mqttBaseTopic}/state/buzzer/detect`,
    mainDoorStatusTopic: `${mqttBaseTopic}/state/door/main`,
    autoDoorStatusTopic: `${mqttBaseTopic}/state/door/rfid`,
    lightStatusTopic: `${mqttBaseTopic}/state/light`,
    autoLightStatusTopic: `${mqttBaseTopic}/state/light/auto`,
    gasTopic: `${mqttBaseTopic}/sensor/gas`,
    humidityTopic: `${mqttBaseTopic}/sensor/humidity`,
    temperatureTopic: `${mqttBaseTopic}/sensor/temperature`,
    lightTopic: `${mqttBaseTopic}/sensor/light`,
  };
  const dashboardStateUrl = window.__DASHBOARD_STATE_URL__ || '';
  const espHandshakeConfig = {
    questionMessage: 'ARE U HERE',
    answerMessage: 'HERE',
    firstQuestionDelayMs: 1000,
    responseTimeoutMs: 6000,
    retryDelayMs: 5000,
    staleTimeoutMs: 18000,
  };
  let mqttClient = null;
  let isMqttConnected = false;
  let pendingMqttMessages = new Map();
  let espQuestionTimer = null;
  let espResponseTimer = null;
  let espStaleTimer = null;
  let lastEspHandshakeAt = 0;
  let motionResetTimer = null;
  let lastMotionAlertTime = 0;
  let lastGasAlertTime = 0;
  let lastTemperatureAlertTime = 0;
  const alerts = [];
  const storedDashboardState = readDashboardState();
  let isDashboardHydrating = true;

  const updateMqttStatus = (label, color = '#7ca8ea') => {
    if (!mqttConnectionStatus) return;
    mqttConnectionStatus.textContent = label;
    mqttConnectionStatus.style.color = color;
  };

  const clearEspHandshakeTimers = () => {
    if (espQuestionTimer) {
      clearTimeout(espQuestionTimer);
      espQuestionTimer = null;
    }

    if (espResponseTimer) {
      clearTimeout(espResponseTimer);
      espResponseTimer = null;
    }

    if (espStaleTimer) {
      clearTimeout(espStaleTimer);
      espStaleTimer = null;
    }
  };

  const askEspPresence = () => {
    if (!isMqttConnected) return;

    updateMqttStatus('Đang gọi ESP32...', '#7ca8ea');
    publishMqttMessage(mqttConfig.deviceCmdTopic, espHandshakeConfig.questionMessage, (error) => {
      if (error) {
        updateMqttStatus('Lỗi gửi câu hỏi ESP32', '#b45309');
        console.warn('MQTT publish presence question error:', error.message);
      }
    });

    if (espResponseTimer) {
      clearTimeout(espResponseTimer);
    }

    espResponseTimer = setTimeout(() => {
      if (isMqttConnected && !lastEspHandshakeAt) {
        updateMqttStatus('Chưa thấy ESP32 phản hồi', '#b45309');
      }

      if (isMqttConnected) {
        scheduleEspPresenceCheck(espHandshakeConfig.retryDelayMs, '');
      }
    }, espHandshakeConfig.responseTimeoutMs);
  };

  const scheduleEspPresenceCheck = (delayMs = espHandshakeConfig.firstQuestionDelayMs, statusLabel = 'Broker OK, chuẩn bị gọi ESP32...') => {
    clearEspHandshakeTimers();
    lastEspHandshakeAt = 0;

    if (!isMqttConnected) return;

    if (statusLabel) {
      updateMqttStatus(statusLabel, '#7ca8ea');
    }

    espQuestionTimer = setTimeout(askEspPresence, delayMs);
  };

  const markEspConnected = () => {
    if (espQuestionTimer) {
      clearTimeout(espQuestionTimer);
      espQuestionTimer = null;
    }

    if (espResponseTimer) {
      clearTimeout(espResponseTimer);
      espResponseTimer = null;
    }

    if (espStaleTimer) {
      clearTimeout(espStaleTimer);
    }

    lastEspHandshakeAt = Date.now();
    updateMqttStatus('Đã kết nối ESP32', '#48a92a');

    espStaleTimer = setTimeout(() => {
      if (isMqttConnected && Date.now() - lastEspHandshakeAt >= espHandshakeConfig.staleTimeoutMs) {
        updateMqttStatus('Mất tín hiệu ESP32', '#b45309');
        scheduleEspPresenceCheck(espHandshakeConfig.firstQuestionDelayMs, '');
      }
    }, espHandshakeConfig.staleTimeoutMs);
  };

  const handleEspStateMessage = (message) => {
    const normalizedMessage = String(message || '').trim().toUpperCase();

    if (normalizedMessage === espHandshakeConfig.questionMessage) return;
    if (normalizedMessage !== espHandshakeConfig.answerMessage && normalizedMessage !== '1') return;

    markEspConnected();
  };

  const getMqttSubscribeTopics = () => [
    mqttConfig.deviceStateTopic,
    mqttConfig.motionTopic,
    mqttConfig.gasTopic,
    mqttConfig.humidityTopic,
    mqttConfig.temperatureTopic,
    mqttConfig.lightTopic,
    mqttConfig.rgbStatusTopic,
    mqttConfig.fanStatusTopic,
    mqttConfig.buzzerStatusTopic,
    mqttConfig.buzzerDetectStatusTopic,
    mqttConfig.mainDoorStatusTopic,
    mqttConfig.autoDoorStatusTopic,
    mqttConfig.lightStatusTopic,
    mqttConfig.autoLightStatusTopic,
  ];

  const readBinaryState = (message) => {
    const normalized = String(message || '').trim().toUpperCase();
    if (['1', 'ON', 'TRUE', 'YES', 'OPEN', 'DETECTED', 'HERE'].includes(normalized)) return true;
    if (['0', 'OFF', 'FALSE', 'NO', 'CLOSE', 'CLOSED', 'CLEAR', 'NONE'].includes(normalized)) return false;
    return null;
  };

  const applyControlStateMessage = (topic, message) => {
    const state = readBinaryState(message);
    if (state === null) return;

    if (topic === mqttConfig.rgbStatusTopic) {
      if (state) {
        if (rgbToggle && rgbToggle.checked !== true) rgbToggle.checked = true;
        setRgbColorByValue(readDashboardState().controls?.rgbColor || '#005bff', false);
      } else {
        updateRgbOffUi();
      }
    } else if (topic === mqttConfig.fanStatusTopic) {
      if (fanToggle && fanToggle.checked !== state) fanToggle.checked = state;
      updateFanUi(state);
    } else if (topic === mqttConfig.buzzerStatusTopic) {
      updateBuzzerUi(state);
    } else if (topic === mqttConfig.buzzerDetectStatusTopic) {
      updateBuzzerDetectUi(state);
    } else if (topic === mqttConfig.mainDoorStatusTopic) {
      updateMainDoorUi(state);
    } else if (topic === mqttConfig.autoDoorStatusTopic) {
      updateAutoDoorUi(state);
    } else if (topic === mqttConfig.lightStatusTopic) {
      updateLightControlUi(state);
    } else if (topic === mqttConfig.autoLightStatusTopic) {
      updateAutoLightUi(state);
    }
  };

  const persistControlState = (patch) => {
    if (isDashboardHydrating) return;
    writeDashboardState({ controls: patch });
  };

  const persistSensorState = (patch) => {
    if (isDashboardHydrating) return;
    writeDashboardState({ sensors: patch });
  };

  const persistAlertsState = () => {
    if (isDashboardHydrating) return;
    writeDashboardState({ alerts: alerts.slice(0, 5) });
  };

  const connectMqtt = () => {
    if (mqttClient) return;

    if (typeof mqtt === 'undefined') {
      updateMqttStatus('Không tải được thư viện MQTT', '#b45309');
      console.warn('MQTT library is not loaded. Check https://unpkg.com/mqtt/dist/mqtt.min.js');
      return;
    }

    updateMqttStatus('Đang kết nối MQTT...', '#7ca8ea');

    mqttClient = mqtt.connect(mqttConfig.url, {
      clientId: `mekongstem_web_${Math.random().toString(16).slice(2, 10)}`,
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 2000,
    });

    mqttClient.on('connect', () => {
      isMqttConnected = true;
      updateMqttStatus('Broker đã kết nối', '#7ca8ea');
      mqttClient.subscribe(getMqttSubscribeTopics(), { qos: 0 }, (error) => {
        if (error) {
          updateMqttStatus('Lỗi nghe topic ESP32', '#b45309');
          console.warn('MQTT subscribe error:', error.message);
          return;
        }

        scheduleEspPresenceCheck();
      });
      if (pendingMqttMessages.size) {
        const messages = Array.from(pendingMqttMessages.values());
        pendingMqttMessages.clear();
        messages.forEach(({ topic, message, onPublished }) => publishMqttMessage(topic, message, onPublished));
      }
    });

    mqttClient.on('reconnect', () => {
      isMqttConnected = false;
      clearEspHandshakeTimers();
      updateMqttStatus('Đang kết nối lại...', '#b45309');
    });

    mqttClient.on('close', () => {
      isMqttConnected = false;
      clearEspHandshakeTimers();
      updateMqttStatus('MQTT mất kết nối', '#b45309');
    });

    mqttClient.on('error', (error) => {
      updateMqttStatus('Lỗi MQTT', '#b45309');
      console.warn('MQTT error:', error.message);
    });

    mqttClient.on('message', (topic, payload) => {
      const message = payload.toString().trim();
      console.info('MQTT receive:', topic, message);

      if (topic === mqttConfig.deviceStateTopic) {
        handleEspStateMessage(message);
      } else if (topic === mqttConfig.motionTopic) {
        handleMotionMessage(message);
      } else if (topic === mqttConfig.gasTopic) {
        updateGas(message);
      } else if (topic === mqttConfig.humidityTopic) {
        updateHumidity(message);
      } else if (topic === mqttConfig.temperatureTopic) {
        updateTemperature(message);
      } else if (topic === mqttConfig.lightTopic) {
        updateLight(message);
      } else {
        applyControlStateMessage(topic, message);
      }
    });
  };

  const publishMqttMessage = (topic, message, onPublished) => {
    connectMqtt();

    if (!mqttClient || !isMqttConnected) {
      pendingMqttMessages.set(topic, { topic, message, onPublished });
      return;
    }

    mqttClient.publish(topic, message, {
      qos: 0,
      retain: false,
    }, (error) => {
      if (typeof onPublished === 'function') {
        onPublished(error || null);
      }
    });
    console.info('MQTT publish:', topic, message);
  };

  const toBinaryStatePayload = (isOn) => (isOn ? '1' : '0');

  const sendRgbState = (isOn) => {
    publishMqttMessage(mqttConfig.rgbStateTopic, toBinaryStatePayload(isOn));
  };

  const sendRgbColor = (color) => {
    publishMqttMessage(mqttConfig.rgbColorTopic, color);
  };

  const sendFanState = (isOn) => {
    publishMqttMessage(mqttConfig.fanStateTopic, toBinaryStatePayload(isOn));
  };

  const sendFanSpeed = (speed) => {
    publishMqttMessage(mqttConfig.fanSpeedTopic, String(speed));
  };

  const sendBuzzerState = (isOn) => {
    publishMqttMessage(mqttConfig.buzzerStateTopic, toBinaryStatePayload(isOn));
  };

  const sendBuzzerDetectState = (isOn) => {
    publishMqttMessage(mqttConfig.buzzerDetectStateTopic, toBinaryStatePayload(isOn));
  };

  const sendMainDoorState = (isOn) => {
    publishMqttMessage(mqttConfig.mainDoorStateTopic, toBinaryStatePayload(isOn));
  };

  const sendAutoDoorState = (isOn) => {
    publishMqttMessage(mqttConfig.autoDoorStateTopic, toBinaryStatePayload(isOn));
  };

  const sendLightState = (isOn) => {
    publishMqttMessage(mqttConfig.lightStateTopic, toBinaryStatePayload(isOn));
  };

  const sendAutoLightState = (isOn) => {
    publishMqttMessage(mqttConfig.autoLightTopic, toBinaryStatePayload(isOn));
  };

  const getFixedScheduleTarget = (timeValue) => {
    const [hourText, minuteText] = String(timeValue || '14:30').split(':');
    const hour = Math.min(23, Math.max(0, Number.parseInt(hourText, 10) || 0));
    const minute = Math.min(59, Math.max(0, Number.parseInt(minuteText, 10) || 0));
    const target = new Date();
    target.setHours(hour, minute, 0, 0);
    if (target.getTime() <= Date.now()) {
      target.setDate(target.getDate() + 1);
    }
    return { target, hour, minute };
  };

  const normalizeLightSchedule = (schedule) => {
    if (!schedule || typeof schedule !== 'object') return null;
    if (schedule.mode === 'duration') return schedule;
    if (schedule.mode !== 'fixed') return null;

    const sourceItems = Array.isArray(schedule.items)
      ? schedule.items
      : [{
        action: schedule.action,
        hour: schedule.hour,
        minute: schedule.minute,
        targetAt: schedule.targetAt,
      }];

    const items = sourceItems
      .map((item) => {
        const hour = Math.min(23, Math.max(0, Number.parseInt(item?.hour, 10) || 0));
        const minute = Math.min(59, Math.max(0, Number.parseInt(item?.minute, 10) || 0));
        const targetAt = Number(item?.targetAt);
        return {
          action: item?.action === 'on' ? 'on' : 'off',
          hour,
          minute,
          targetAt: Number.isFinite(targetAt) ? targetAt : getFixedScheduleTarget(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`).target.getTime(),
        };
      })
      .filter((item) => Number(item.targetAt) > Date.now())
      .sort((a, b) => Number(a.targetAt) - Number(b.targetAt));

    return items.length ? { mode: 'fixed', items } : null;
  };

  let activeLightSchedule = normalizeLightSchedule(storedDashboardState.controls?.lightSchedule);
  let lightScheduleTimeouts = [];
  let lightCountdownInterval = null;

  const formatHourMinuteText = (hour, minute) => `${Number(hour)} giờ ${Number(minute)} phút`;

  const formatCountdownText = (remainingMs) => {
    const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, '0')}`;
  };

  const setLightScheduleNotice = (text = '') => {
    if (lightScheduleNotice) {
      lightScheduleNotice.textContent = text;
    }
  };

  const persistLightSchedule = (schedule) => {
    activeLightSchedule = schedule;
    writeDashboardState({ controls: { lightSchedule: schedule } });
  };

  const clearLightScheduleTimers = () => {
    lightScheduleTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    lightScheduleTimeouts = [];
    if (lightCountdownInterval) {
      window.clearInterval(lightCountdownInterval);
      lightCountdownInterval = null;
    }
  };

  const completeLightSchedule = () => {
    persistLightSchedule(null);
    clearLightScheduleTimers();
  };

  const applyScheduledLightState = (isOn) => {
    updateLightControlUi(isOn);
    sendLightState(isOn);
  };

  const renderActiveLightSchedule = () => {
    if (!activeLightSchedule) {
      setLightScheduleNotice('');
      return;
    }

    if (activeLightSchedule.mode === 'duration') {
      const targetMs = Number(activeLightSchedule.targetAt);
      const remainingMs = targetMs - Date.now();
      if (!Number.isFinite(targetMs) || remainingMs <= 0) {
        applyScheduledLightState(false);
        completeLightSchedule();
        setLightScheduleNotice('');
        return;
      }
      setLightScheduleNotice(`Sẽ tắt đèn sau ${formatCountdownText(remainingMs)}`);
      return;
    }

    if (activeLightSchedule.mode === 'fixed') {
      const notices = (activeLightSchedule.items || []).map((item) => {
        const actionText = item.action === 'on' ? 'bật đèn' : 'tắt đèn';
        return `Sẽ ${actionText} vào ${formatHourMinuteText(item.hour, item.minute)}`;
      });
      setLightScheduleNotice(notices.join('; '));
    }
  };

  const armLightSchedule = () => {
    clearLightScheduleTimers();
    if (!activeLightSchedule) {
      renderActiveLightSchedule();
      return;
    }

    renderActiveLightSchedule();

    if (activeLightSchedule.mode === 'duration') {
      lightCountdownInterval = window.setInterval(renderActiveLightSchedule, 1000);
      const remainingMs = Math.max(0, Number(activeLightSchedule.targetAt) - Date.now());
      const timeoutId = window.setTimeout(() => {
        applyScheduledLightState(false);
        completeLightSchedule();
        setLightScheduleNotice('');
      }, remainingMs);
      lightScheduleTimeouts.push(timeoutId);
      return;
    }

    if (activeLightSchedule.mode === 'fixed') {
      const upcomingItems = (activeLightSchedule.items || [])
        .filter((item) => Number(item.targetAt) > Date.now())
        .sort((a, b) => Number(a.targetAt) - Number(b.targetAt));
      if (!upcomingItems.length) {
        completeLightSchedule();
        setLightScheduleNotice('');
        return;
      }
      activeLightSchedule.items = upcomingItems;
      upcomingItems.forEach((item) => {
        const timeoutId = window.setTimeout(() => {
          applyScheduledLightState(item.action === 'on');
          if (!activeLightSchedule || activeLightSchedule.mode !== 'fixed') return;
          const remainingItems = (activeLightSchedule.items || []).filter((nextItem) => nextItem !== item);
          persistLightSchedule(remainingItems.length ? { mode: 'fixed', items: remainingItems } : null);
          armLightSchedule();
        }, Number(item.targetAt) - Date.now());
        lightScheduleTimeouts.push(timeoutId);
      });
    }
  };

  const getFixedRows = () => Array.from(lightFixedList?.querySelectorAll('.light-fixed-row') || []);

  const createFixedRow = (item = {}, canRemove = true) => {
    const row = document.createElement('div');
    row.className = 'light-settings-inline light-fixed-row';

    const actionSelect = document.createElement('select');
    actionSelect.className = 'light-fixed-action';
    actionSelect.setAttribute('aria-label', 'Hành động hẹn giờ');
    actionSelect.innerHTML = '<option value="off">Tắt đèn</option><option value="on">Bật đèn</option>';
    actionSelect.value = item.action === 'on' ? 'on' : 'off';

    const timeInput = document.createElement('input');
    timeInput.className = 'light-fixed-time';
    timeInput.type = 'time';
    timeInput.setAttribute('aria-label', 'Thời gian hẹn giờ');
    timeInput.value = `${String(item.hour ?? 14).padStart(2, '0')}:${String(item.minute ?? 30).padStart(2, '0')}`;

    row.append(actionSelect, timeInput);

    if (canRemove) {
      const removeButton = document.createElement('button');
      removeButton.className = 'light-fixed-remove';
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', 'Xóa mốc hẹn giờ');
      removeButton.innerHTML = '<i class="fa-solid fa-minus"></i>';
      removeButton.addEventListener('click', () => {
        row.remove();
        if (!getFixedRows().length && lightFixedList) {
          lightFixedList.append(createFixedRow({ action: 'off', hour: 14, minute: 30 }, false));
        }
      });
      row.append(removeButton);
    }

    [actionSelect, timeInput].forEach((control) => {
      control.addEventListener('focus', () => {
        if (lightScheduleModeFixed) lightScheduleModeFixed.checked = true;
      });
      control.addEventListener('change', () => {
        if (lightScheduleModeFixed) lightScheduleModeFixed.checked = true;
      });
    });

    return row;
  };

  const renderFixedRows = (items = []) => {
    if (!lightFixedList) return;
    lightFixedList.innerHTML = '';
    const nextItems = items.length ? items : [{ action: 'off', hour: 14, minute: 30 }];
    nextItems.forEach((item, index) => {
      lightFixedList.append(createFixedRow(item, index > 0));
    });
  };

  const collectFixedScheduleItems = () => getFixedRows().map((row) => {
    const action = row.querySelector('select')?.value === 'on' ? 'on' : 'off';
    const timeValue = row.querySelector('input[type="time"]')?.value || '14:30';
    const scheduleTime = getFixedScheduleTarget(timeValue);
    return {
      action,
      hour: scheduleTime.hour,
      minute: scheduleTime.minute,
      targetAt: scheduleTime.target.getTime(),
    };
  }).sort((a, b) => Number(a.targetAt) - Number(b.targetAt));

  const openLightSettings = () => {
    if (!lightSettingsModal) return;
    const schedule = activeLightSchedule;
    if (schedule?.mode === 'duration') {
      lightScheduleModeDuration.checked = true;
      lightDurationPreset.value = ['5', '10', '15'].includes(String(schedule.minutes)) ? String(schedule.minutes) : 'custom';
      lightDurationCustom.value = String(schedule.minutes || 5);
      renderFixedRows();
    } else {
      lightScheduleModeFixed.checked = true;
      renderFixedRows(schedule?.mode === 'fixed' ? schedule.items : []);
    }
    lightSettingsModal.classList.add('is-visible');
    lightSettingsModal.setAttribute('aria-hidden', 'false');
    lightSettingsButton?.setAttribute('aria-expanded', 'true');
    lightSettingsOk?.focus();
  };

  const closeLightSettings = () => {
    if (!lightSettingsModal) return;
    lightSettingsModal.classList.remove('is-visible');
    lightSettingsModal.setAttribute('aria-hidden', 'true');
    lightSettingsButton?.setAttribute('aria-expanded', 'false');
  };

  const saveLightSettings = () => {
    const mode = lightScheduleModeDuration?.checked ? 'duration' : 'fixed';

    if (mode === 'duration') {
      const presetValue = lightDurationPreset?.value || '5';
      const minutes = presetValue === 'custom'
        ? Number.parseInt(lightDurationCustom?.value, 10)
        : Number.parseInt(presetValue, 10);
      const safeMinutes = Math.min(999, Math.max(1, Number.isFinite(minutes) ? minutes : 5));
      applyScheduledLightState(true);
      persistLightSchedule({
        mode: 'duration',
        minutes: safeMinutes,
        targetAt: Date.now() + safeMinutes * 60000,
      });
      armLightSchedule();
      closeLightSettings();
      return;
    }

    persistLightSchedule({
      mode: 'fixed',
      items: collectFixedScheduleItems(),
    });
    armLightSchedule();
    closeLightSettings();
  };

  connectMqtt();

  const formatCurrentTime = () => {
    return new Date().toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const parseSensorValue = (message) => {
    const value = Number.parseFloat(String(message).replace(',', '.').replace(/[^\d.-]/g, ''));
    return Number.isFinite(value) ? value : null;
  };

  const normalizeBoolean = (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      return ['1', 'true', 'on', 'yes', 'open', 'detected'].includes(value.trim().toLowerCase());
    }
    return null;
  };

  const formatNumber = (value, maximumFractionDigits = 1) => {
    return new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits,
    }).format(value);
  };

  const setStatus = (element, label, color = '#7ca8ea') => {
    if (!element) return;

    element.style.color = color;
    element.innerHTML = `<span class="inline-block w-1.5 h-1.5 rounded-full mr-1" style="background-color:${color}"></span> ${label}`;
  };

  const renderAlerts = () => {
    if (!alertsList) return;

    if (alertCount) {
      alertCount.textContent = String(Math.min(alerts.length, 99));
      alertCount.classList.toggle('hidden', alerts.length === 0);
    }

    if (!alerts.length) {
      alertsList.innerHTML = `
        <div class="h-full min-h-40 flex flex-col items-center justify-center text-center text-slate-400">
          <i class="fa-regular fa-bell-slash text-2xl mb-2"></i>
          <p class="text-sm font-semibold text-slate-500">Chưa có cảnh báo</p>
          <p class="text-xs">Hệ thống sẽ tự tạo cảnh báo khi dữ liệu vượt ngưỡng.</p>
        </div>
      `;
      return;
    }

    alertsList.innerHTML = alerts.slice(0, 5).map((alert) => `
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 ${alert.iconClass} rounded-lg flex items-center justify-center">
          <i class="fa-solid ${alert.icon}"></i>
        </div>
        <div class="flex-1">
          <p class="text-sm font-semibold">${alert.title}</p>
          <p class="text-xs text-slate-500">${alert.location}</p>
        </div>
        <span class="text-xs ${alert.timeClass} font-medium">${alert.time}</span>
      </div>
    `).join('');

    persistAlertsState();
  };

  const updateRgbOffUi = () => {
    rgbStatus.textContent = 'Tắt';
    rgbStatus.style.color = '#5d6775';
    rgbIcon.style.backgroundColor = '#dbe6f5';
    rgbCard.style.borderBottomColor = '#dbe6f5';
    rgbCard.classList.remove('border-b-4', 'border-mekong-blue');
  };

  const setRgbColor = (button, shouldPublish = true) => {
    const color = button.dataset.color || '#2a5ea9';
    const name = button.dataset.name || 'Tùy chọn';

    colorButtons.forEach((item) => {
      item.classList.remove('is-selected');
      item.setAttribute('aria-checked', 'false');
      item.setAttribute('role', 'radio');
    });

    button.classList.add('is-selected');
    button.setAttribute('aria-checked', 'true');
    if (!rgbToggle || rgbToggle.checked) {
      rgbStatus.textContent = name;
      rgbStatus.style.color = color;
      rgbIcon.style.backgroundColor = color;
      rgbCard.style.borderBottomColor = color;
      rgbCard.classList.add('border-b-4');
      if (shouldPublish) {
        sendRgbColor(color);
        sendRgbState(true);
      }
    } else {
      updateRgbOffUi();
    }

    persistControlState({
      rgbOn: rgbToggle ? rgbToggle.checked : true,
      rgbColor: color,
      rgbColorName: name,
    });
  };

  const setRgbColorByValue = (color, shouldPublish = true) => {
    const targetColor = String(color || '').trim().toLowerCase();
    const button = Array.from(colorButtons).find((item) => String(item.dataset.color || '').trim().toLowerCase() === targetColor);

    if (button) {
      setRgbColor(button, shouldPublish);
    }
  };

  const addMotionAlert = () => {
    const now = Date.now();
    if (now - lastMotionAlertTime < 5000) return;

    lastMotionAlertTime = now;
    alerts.unshift({
      title: 'Phát hiện chuyển động',
      location: 'Cửa chính',
      time: formatCurrentTime(),
      icon: 'fa-person-running',
      iconClass: 'bg-mekong-light-blue text-mekong-blue',
      timeClass: 'text-mekong-brown',
    });
    renderAlerts();
  };

  const addSensorAlert = ({ type, title, location, icon, iconClass }) => {
    const now = Date.now();
    const alertWindowMs = 10000;

    if (type === 'gas') {
      if (now - lastGasAlertTime < alertWindowMs) return;
      lastGasAlertTime = now;
    }

    if (type === 'temperature') {
      if (now - lastTemperatureAlertTime < alertWindowMs) return;
      lastTemperatureAlertTime = now;
    }

    alerts.unshift({
      title,
      location,
      time: formatCurrentTime(),
      icon,
      iconClass,
      timeClass: 'text-mekong-brown',
    });
    renderAlerts();
  };

  const updateTemperature = (message, options = {}) => {
    const value = parseSensorValue(message);
    if (value === null || !temperatureValue) return;

    temperatureValue.textContent = `${formatNumber(value)}°C`;
    persistSensorState({ temperature: value });

    if (value >= 35) {
      setStatus(temperatureStatus, 'Nhiệt độ cao', '#6a4b17');
      addSensorAlert({
        type: 'temperature',
        title: 'Nhiệt độ cao',
        location: 'Phòng khách',
        icon: 'fa-temperature-high',
        iconClass: 'bg-mekong-brown/10 text-mekong-brown',
      });
    } else if (value <= 18) {
      setStatus(temperatureStatus, 'Nhiệt độ thấp', '#2a5ea9');
    } else {
      setStatus(temperatureStatus, 'Bình thường');
    }

    if (!options.skipChartUpdate) {
      window.__MEKONG_TEMP_CHART__?.append(value, new Date());
    }
  };

  const updateHumidity = (message) => {
    const value = parseSensorValue(message);
    if (value === null || !humidityValue) return;

    humidityValue.textContent = `${formatNumber(value, 0)}%`;
    persistSensorState({ humidity: value });

    if (value >= 80) {
      setStatus(humidityStatus, 'Độ ẩm cao', '#6a4b17');
    } else if (value <= 35) {
      setStatus(humidityStatus, 'Độ ẩm thấp', '#6a4b17');
    } else {
      setStatus(humidityStatus, 'Bình thường');
    }
  };

  const updateLight = (message) => {
    const value = parseSensorValue(message);
    if (value === null || !lightValue) return;

    lightValue.innerHTML = `${formatNumber(value, 0)} <span class="text-sm font-medium">lux</span>`;
    persistSensorState({ light: value });

    if (value < 25) {
      setStatus(lightStatus, 'Thiếu sáng', '#6a4b17');
    } else if (value > 90) {
      setStatus(lightStatus, 'Rất sáng', '#6a4b17');
    } else {
      setStatus(lightStatus, 'Tốt');
    }
  };

  const updateGas = (message) => {
    const value = parseSensorValue(message);
    if (value === null || !gasValue) return;

    gasValue.innerHTML = `${formatNumber(value, 0)} <span class="text-sm font-medium">ppm</span>`;
    persistSensorState({ gas: value });

    if (value >= 300) {
      setStatus(gasStatus, 'Nguy hiểm', '#6a4b17');
      addSensorAlert({
        type: 'gas',
        title: 'Phát hiện khí gas',
        location: 'Phòng bếp',
        icon: 'fa-fire-flame-curved',
        iconClass: 'bg-mekong-brown/10 text-mekong-brown',
      });
    } else if (value >= 200) {
      setStatus(gasStatus, 'Cần chú ý', '#6a4b17');
    } else {
      setStatus(gasStatus, 'An toàn');
    }
  };

  const updateMotionUi = (isDetected) => {
    if (!motionStatusCard || !motionStatusIcon || !motionStatusValue || !motionStatusText) return;

    if (isDetected) {
      motionStatusValue.textContent = 'Có người';
      motionStatusText.innerHTML = '<span class="inline-block w-1.5 h-1.5 rounded-full mr-1" style="background-color:#6a4b17"></span> Đang phát hiện';
      motionStatusValue.style.color = '#6a4b17';
      motionStatusIcon.style.backgroundColor = '#6a4b17';
      motionStatusCard.classList.add('border-b-4');
      motionStatusCard.style.borderBottomColor = '#6a4b17';
    } else {
      motionStatusValue.textContent = 'Không có';
      motionStatusText.innerHTML = '<span class="inline-block w-1.5 h-1.5 rounded-full mr-1" style="background-color:#7ca8ea"></span> Không phát hiện';
      motionStatusValue.style.color = '#0f172a';
      motionStatusIcon.style.backgroundColor = '#2a5ea9';
      motionStatusCard.classList.remove('border-b-4');
      motionStatusCard.style.borderBottomColor = '#dbe6f5';
    }

    persistControlState({ motionDetected: isDetected });
  };

  const handleMotionMessage = (message) => {
    const normalized = message.toUpperCase();
    const isClearMessage = ['0', 'OFF', 'NO', 'NONE', 'FALSE', 'CLEAR'].includes(normalized);
    const isDetected = !isClearMessage;

    updateMotionUi(isDetected);

    if (isDetected) {
      addMotionAlert();
      window.clearTimeout(motionResetTimer);
      motionResetTimer = window.setTimeout(() => updateMotionUi(false), 10000);
    } else {
      window.clearTimeout(motionResetTimer);
    }
  };

  const seedAlertsFromCurrentDashboard = () => {
    updateTemperature(temperatureValue?.textContent || '', { skipChartUpdate: true });
    updateHumidity(humidityValue?.textContent || '');
    updateLight(lightValue?.textContent || '');
    updateGas(gasValue?.textContent || '');

    const currentMotionText = `${motionStatusValue?.textContent || ''} ${motionStatusText?.textContent || ''}`.toLowerCase();
    if (currentMotionText.includes('có người') || currentMotionText.includes('đang phát hiện')) {
      addMotionAlert();
    }

    renderAlerts();
  };

  const applyDashboardSnapshot = (snapshot) => {
    if (!snapshot || typeof snapshot !== 'object') return;

    const sensors = snapshot.sensors && typeof snapshot.sensors === 'object' ? snapshot.sensors : snapshot;
    const controls = snapshot.controls && typeof snapshot.controls === 'object' ? snapshot.controls : snapshot;

    const temperature = sensors.temperature ?? sensors.temp ?? snapshot.temperature ?? snapshot.temp;
    if (temperature != null) {
      updateTemperature(temperature, { skipChartUpdate: true });
    }

    const humidity = sensors.humidity ?? snapshot.humidity;
    if (humidity != null) {
      updateHumidity(humidity);
    }

    const light = sensors.light ?? snapshot.light;
    if (light != null) {
      updateLight(light);
    }

    const gas = sensors.gas ?? snapshot.gas;
    if (gas != null) {
      updateGas(gas);
    }

    const lightOn = normalizeBoolean(controls.lightOn ?? snapshot.lightOn ?? controls.light ?? snapshot.light);
    if (lightOn !== null) {
      updateLightControlUi(lightOn);
    }

    const autoLightOn = normalizeBoolean(controls.autoLightOn ?? snapshot.autoLightOn ?? controls.autoLight ?? snapshot.autoLight);
    if (autoLightOn !== null) {
      updateAutoLightUi(autoLightOn);
      if (autoLightToggle && autoLightToggle.checked !== autoLightOn) {
        autoLightToggle.checked = autoLightOn;
      }
    }

    const motionDetected = normalizeBoolean(controls.motionDetected ?? snapshot.motionDetected);
    if (motionDetected !== null) {
      updateMotionUi(motionDetected);
    }

    const fanOn = normalizeBoolean(controls.fanOn ?? snapshot.fanOn);
    if (fanOn !== null) {
      if (fanToggle && fanToggle.checked !== fanOn) {
        fanToggle.checked = fanOn;
      }
      if (fanSpeedSlider && controls.fanSpeed !== undefined) {
        fanSpeedSlider.value = String(controls.fanSpeed);
        if (fanSpeedValue) {
          fanSpeedValue.textContent = `${fanSpeedSlider.value}%`;
        }
      }
      updateFanUi(fanOn);
    }

    const buzzerOn = normalizeBoolean(controls.buzzerOn ?? snapshot.buzzerOn);
    if (buzzerOn !== null) {
      updateBuzzerUi(buzzerOn);
    }

    const buzzerDetectOn = normalizeBoolean(controls.buzzerDetectOn ?? snapshot.buzzerDetectOn);
    if (buzzerDetectOn !== null) {
      updateBuzzerDetectUi(buzzerDetectOn);
    }

    const mainDoorOpen = normalizeBoolean(controls.mainDoorOpen ?? snapshot.mainDoorOpen ?? controls.doorOpen ?? snapshot.doorOpen);
    if (mainDoorOpen !== null) {
      updateMainDoorUi(mainDoorOpen);
    }

    const autoDoorOn = normalizeBoolean(controls.autoDoorOn ?? snapshot.autoDoorOn ?? controls.autoDoor ?? snapshot.autoDoor);
    if (autoDoorOn !== null) {
      updateAutoDoorUi(autoDoorOn);
    }

    const rgbOn = normalizeBoolean(controls.rgbOn ?? snapshot.rgbOn);
    if (rgbOn !== null && rgbToggle && rgbToggle.checked !== rgbOn) {
      rgbToggle.checked = rgbOn;
    }

    if (controls.rgbColor ?? snapshot.rgbColor) {
      setRgbColorByValue(controls.rgbColor ?? snapshot.rgbColor, false);
    } else if (controls.rgbColorName ?? snapshot.rgbColorName) {
      const targetName = String(controls.rgbColorName ?? snapshot.rgbColorName).trim().toLowerCase();
      const button = Array.from(colorButtons).find((item) => String(item.dataset.name || '').trim().toLowerCase() === targetName);
      if (button) {
        setRgbColor(button, false);
      }
    }

    const alertItems = Array.isArray(snapshot.alerts) ? snapshot.alerts : Array.isArray(snapshot.recentAlerts) ? snapshot.recentAlerts : null;
    if (alertItems) {
      alerts.length = 0;
      alertItems.slice(0, 5).forEach((item) => {
        alerts.push({
          title: item.title || item.name || 'Cảnh báo',
          location: item.location || item.room || '',
          time: item.time || item.createdAt || formatCurrentTime(),
          icon: item.icon || 'fa-bell',
          iconClass: item.iconClass || 'bg-mekong-light-blue text-mekong-blue',
          timeClass: item.timeClass || 'text-mekong-brown',
        });
      });
      renderAlerts();
    }
  };

  const loadDashboardStateFromServer = async () => {
    if (!dashboardStateUrl) return;

    try {
      const response = await fetch(`${dashboardStateUrl}${dashboardStateUrl.includes('?') ? '&' : '?'}ts=${Date.now()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const snapshot = await response.json();
      applyDashboardSnapshot(snapshot);
    } catch (error) {
      console.warn('Không tải được trạng thái từ server:', error.message);
      seedAlertsFromCurrentDashboard();
    }
  };

  const updateLightControlUi = (isOn) => {
    if (!lightControlCard || !lightControlIcon || !lightControlStatus) return;

    if (lightToggle && lightToggle.checked !== isOn) {
      lightToggle.checked = isOn;
    }

    if (favoriteLightToggle && favoriteLightToggle.checked !== isOn) {
      favoriteLightToggle.checked = isOn;
    }

    if (isOn) {
      lightControlStatus.textContent = 'Bật';
      lightControlStatus.style.color = '#2a5ea9';
      lightControlIcon.style.backgroundColor = '#2a5ea9';
      lightControlCard.style.borderBottomColor = '#2a5ea9';
      lightControlCard.classList.add('border-b-4', 'border-mekong-blue');
    } else {
      lightControlStatus.textContent = 'Tắt';
      lightControlStatus.style.color = '#5d6775';
      lightControlIcon.style.backgroundColor = '#dbe6f5';
      lightControlCard.style.borderBottomColor = '#dbe6f5';
      lightControlCard.classList.remove('border-b-4', 'border-mekong-blue');
    }

    persistControlState({ lightOn: isOn });
  };

  const updateAutoLightUi = (isOn) => {
    if (autoLightToggle && autoLightToggle.checked !== isOn) {
      autoLightToggle.checked = isOn;
    }

    persistControlState({ autoLightOn: isOn });
  };

  const handleLightToggleChange = (isOn) => {
    updateLightControlUi(isOn);
    sendLightState(isOn);
  };

  if (lightToggle) {
    updateLightControlUi(lightToggle.checked);
    lightToggle.addEventListener('change', () => handleLightToggleChange(lightToggle.checked));
  }

  if (favoriteLightToggle) {
    favoriteLightToggle.checked = lightToggle?.checked ?? favoriteLightToggle.checked;
    favoriteLightToggle.addEventListener('change', () => handleLightToggleChange(favoriteLightToggle.checked));
  }

  if (autoLightToggle) {
    updateAutoLightUi(autoLightToggle.checked);
    autoLightToggle.addEventListener('change', () => {
      updateAutoLightUi(autoLightToggle.checked);
      sendAutoLightState(autoLightToggle.checked);
    });
  }

  if (lightSettingsButton && lightSettingsModal && lightSettingsOk) {
    lightSettingsButton.addEventListener('click', openLightSettings);
    lightFixedAdd?.addEventListener('click', () => {
      if (lightScheduleModeFixed) lightScheduleModeFixed.checked = true;
      lightFixedList?.append(createFixedRow({ action: 'off', hour: 14, minute: 30 }, true));
    });
    lightSettingsClose?.addEventListener('click', closeLightSettings);
    lightSettingsCancel?.addEventListener('click', closeLightSettings);
    lightSettingsOk.addEventListener('click', saveLightSettings);
    lightSettingsModal.addEventListener('click', (event) => {
      if (event.target === lightSettingsModal) {
        closeLightSettings();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && lightSettingsModal.classList.contains('is-visible')) {
        closeLightSettings();
      }
    });
  }

  [lightFixedAction, lightFixedTime].forEach((control) => {
    control?.addEventListener('focus', () => {
      if (lightScheduleModeFixed) lightScheduleModeFixed.checked = true;
    });
    control?.addEventListener('change', () => {
      if (lightScheduleModeFixed) lightScheduleModeFixed.checked = true;
    });
  });

  [lightDurationPreset, lightDurationCustom].forEach((control) => {
    control?.addEventListener('focus', () => {
      if (lightScheduleModeDuration) lightScheduleModeDuration.checked = true;
    });
    control?.addEventListener('change', () => {
      if (lightScheduleModeDuration) lightScheduleModeDuration.checked = true;
    });
  });

  if (lightDurationPreset && lightDurationCustom) {
    const syncDurationCustomState = () => {
      lightDurationCustom.disabled = lightDurationPreset.value !== 'custom';
      lightDurationCustom.classList.toggle('opacity-50', lightDurationCustom.disabled);
    };
    lightDurationPreset.addEventListener('change', syncDurationCustomState);
    syncDurationCustomState();
  }

  armLightSchedule();

  const updateFanUi = (isOn) => {
    const speed = fanSpeedSlider?.value || '0';

    if (!fanCard || !fanIcon || !fanStatus) return;

    if (isOn) {
      fanStatus.textContent = `${speed}%`;
      fanStatus.style.color = '#2a5ea9';
      fanIcon.style.backgroundColor = '#2a5ea9';
      fanCard.style.borderBottomColor = '#2a5ea9';
      fanCard.classList.add('border-b-4', 'border-mekong-blue');
    } else {
      fanStatus.textContent = 'Tắt';
      fanStatus.style.color = '#5d6775';
      fanIcon.style.backgroundColor = '#dbe6f5';
      fanCard.style.borderBottomColor = '#dbe6f5';
      fanCard.classList.remove('border-b-4', 'border-mekong-blue');
    }

    persistControlState({ fanOn: isOn, fanSpeed: Number.parseInt(speed, 10) || 0 });
  };

  let activeFanSchedule = normalizeLightSchedule(storedDashboardState.controls?.fanSchedule);
  let fanScheduleTimeouts = [];
  let fanCountdownInterval = null;

  const setFanScheduleNotice = (text = '') => {
    if (fanScheduleNotice) {
      fanScheduleNotice.textContent = text;
    }
  };

  const persistFanSchedule = (schedule) => {
    activeFanSchedule = schedule;
    writeDashboardState({ controls: { fanSchedule: schedule } });
  };

  const clearFanScheduleTimers = () => {
    fanScheduleTimeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    fanScheduleTimeouts = [];
    if (fanCountdownInterval) {
      window.clearInterval(fanCountdownInterval);
      fanCountdownInterval = null;
    }
  };

  const completeFanSchedule = () => {
    persistFanSchedule(null);
    clearFanScheduleTimers();
  };

  const applyScheduledFanState = (isOn) => {
    if (fanToggle && fanToggle.checked !== isOn) {
      fanToggle.checked = isOn;
    }
    updateFanUi(isOn);
    if (isOn && fanSpeedSlider) {
      sendFanSpeed(fanSpeedSlider.value);
    }
    sendFanState(isOn);
  };

  const renderActiveFanSchedule = () => {
    if (!activeFanSchedule) {
      setFanScheduleNotice('');
      return;
    }

    if (activeFanSchedule.mode === 'duration') {
      const targetMs = Number(activeFanSchedule.targetAt);
      const remainingMs = targetMs - Date.now();
      if (!Number.isFinite(targetMs) || remainingMs <= 0) {
        applyScheduledFanState(false);
        completeFanSchedule();
        setFanScheduleNotice('');
        return;
      }
      setFanScheduleNotice(`Sẽ tắt quạt sau ${formatCountdownText(remainingMs)}`);
      return;
    }

    if (activeFanSchedule.mode === 'fixed') {
      const notices = (activeFanSchedule.items || []).map((item) => {
        const actionText = item.action === 'on' ? 'bật quạt' : 'tắt quạt';
        return `Sẽ ${actionText} vào ${formatHourMinuteText(item.hour, item.minute)}`;
      });
      setFanScheduleNotice(notices.join('; '));
    }
  };

  const armFanSchedule = () => {
    clearFanScheduleTimers();
    if (!activeFanSchedule) {
      renderActiveFanSchedule();
      return;
    }

    renderActiveFanSchedule();

    if (activeFanSchedule.mode === 'duration') {
      fanCountdownInterval = window.setInterval(renderActiveFanSchedule, 1000);
      const remainingMs = Math.max(0, Number(activeFanSchedule.targetAt) - Date.now());
      const timeoutId = window.setTimeout(() => {
        applyScheduledFanState(false);
        completeFanSchedule();
        setFanScheduleNotice('');
      }, remainingMs);
      fanScheduleTimeouts.push(timeoutId);
      return;
    }

    if (activeFanSchedule.mode === 'fixed') {
      const upcomingItems = (activeFanSchedule.items || [])
        .filter((item) => Number(item.targetAt) > Date.now())
        .sort((a, b) => Number(a.targetAt) - Number(b.targetAt));
      if (!upcomingItems.length) {
        completeFanSchedule();
        setFanScheduleNotice('');
        return;
      }
      activeFanSchedule.items = upcomingItems;
      upcomingItems.forEach((item) => {
        const timeoutId = window.setTimeout(() => {
          applyScheduledFanState(item.action === 'on');
          if (!activeFanSchedule || activeFanSchedule.mode !== 'fixed') return;
          const remainingItems = (activeFanSchedule.items || []).filter((nextItem) => nextItem !== item);
          persistFanSchedule(remainingItems.length ? { mode: 'fixed', items: remainingItems } : null);
          armFanSchedule();
        }, Number(item.targetAt) - Date.now());
        fanScheduleTimeouts.push(timeoutId);
      });
    }
  };

  const getFanFixedRows = () => Array.from(fanFixedList?.querySelectorAll('.light-fixed-row') || []);

  const createFanFixedRow = (item = {}, canRemove = true) => {
    const row = document.createElement('div');
    row.className = 'light-settings-inline light-fixed-row';

    const actionSelect = document.createElement('select');
    actionSelect.className = 'fan-fixed-action';
    actionSelect.setAttribute('aria-label', 'Hành động hẹn giờ quạt');
    actionSelect.innerHTML = '<option value="off">Tắt quạt</option><option value="on">Bật quạt</option>';
    actionSelect.value = item.action === 'on' ? 'on' : 'off';

    const timeInput = document.createElement('input');
    timeInput.className = 'fan-fixed-time';
    timeInput.type = 'time';
    timeInput.setAttribute('aria-label', 'Thời gian hẹn giờ quạt');
    timeInput.value = `${String(item.hour ?? 14).padStart(2, '0')}:${String(item.minute ?? 30).padStart(2, '0')}`;

    row.append(actionSelect, timeInput);

    if (canRemove) {
      const removeButton = document.createElement('button');
      removeButton.className = 'light-fixed-remove';
      removeButton.type = 'button';
      removeButton.setAttribute('aria-label', 'Xóa mốc hẹn giờ quạt');
      removeButton.innerHTML = '<i class="fa-solid fa-minus"></i>';
      removeButton.addEventListener('click', () => {
        row.remove();
        if (!getFanFixedRows().length && fanFixedList) {
          fanFixedList.append(createFanFixedRow({ action: 'off', hour: 14, minute: 30 }, false));
        }
      });
      row.append(removeButton);
    }

    [actionSelect, timeInput].forEach((control) => {
      control.addEventListener('focus', () => {
        if (fanScheduleModeFixed) fanScheduleModeFixed.checked = true;
      });
      control.addEventListener('change', () => {
        if (fanScheduleModeFixed) fanScheduleModeFixed.checked = true;
      });
    });

    return row;
  };

  const renderFanFixedRows = (items = []) => {
    if (!fanFixedList) return;
    fanFixedList.innerHTML = '';
    const nextItems = items.length ? items : [{ action: 'off', hour: 14, minute: 30 }];
    nextItems.forEach((item, index) => {
      fanFixedList.append(createFanFixedRow(item, index > 0));
    });
  };

  const collectFanFixedScheduleItems = () => getFanFixedRows().map((row) => {
    const action = row.querySelector('select')?.value === 'on' ? 'on' : 'off';
    const timeValue = row.querySelector('input[type="time"]')?.value || '14:30';
    const scheduleTime = getFixedScheduleTarget(timeValue);
    return {
      action,
      hour: scheduleTime.hour,
      minute: scheduleTime.minute,
      targetAt: scheduleTime.target.getTime(),
    };
  }).sort((a, b) => Number(a.targetAt) - Number(b.targetAt));

  const openFanSettings = () => {
    if (!fanSettingsModal) return;
    const schedule = activeFanSchedule;
    if (schedule?.mode === 'duration') {
      fanScheduleModeDuration.checked = true;
      fanDurationPreset.value = ['5', '10', '15'].includes(String(schedule.minutes)) ? String(schedule.minutes) : 'custom';
      fanDurationCustom.value = String(schedule.minutes || 5);
      renderFanFixedRows();
    } else {
      fanScheduleModeFixed.checked = true;
      renderFanFixedRows(schedule?.mode === 'fixed' ? schedule.items : []);
    }
    fanSettingsModal.classList.add('is-visible');
    fanSettingsModal.setAttribute('aria-hidden', 'false');
    fanSettingsButton?.setAttribute('aria-expanded', 'true');
    fanSettingsOk?.focus();
  };

  const closeFanSettings = () => {
    if (!fanSettingsModal) return;
    fanSettingsModal.classList.remove('is-visible');
    fanSettingsModal.setAttribute('aria-hidden', 'true');
    fanSettingsButton?.setAttribute('aria-expanded', 'false');
  };

  const saveFanSettings = () => {
    const mode = fanScheduleModeDuration?.checked ? 'duration' : 'fixed';

    if (mode === 'duration') {
      const presetValue = fanDurationPreset?.value || '5';
      const minutes = presetValue === 'custom'
        ? Number.parseInt(fanDurationCustom?.value, 10)
        : Number.parseInt(presetValue, 10);
      const safeMinutes = Math.min(999, Math.max(1, Number.isFinite(minutes) ? minutes : 5));
      applyScheduledFanState(true);
      persistFanSchedule({
        mode: 'duration',
        minutes: safeMinutes,
        targetAt: Date.now() + safeMinutes * 60000,
      });
      armFanSchedule();
      closeFanSettings();
      return;
    }

    persistFanSchedule({
      mode: 'fixed',
      items: collectFanFixedScheduleItems(),
    });
    armFanSchedule();
    closeFanSettings();
  };

  const updateBuzzerUi = (isOn) => {
    if (!buzzerCard || !buzzerIcon || !buzzerStatus) return;

    if (buzzerToggle && buzzerToggle.checked !== isOn) {
      buzzerToggle.checked = isOn;
    }

    if (isOn) {
      buzzerStatus.textContent = 'Bật';
      buzzerStatus.style.color = '#2a5ea9';
      buzzerIcon.style.backgroundColor = '#2a5ea9';
      buzzerCard.style.borderBottomColor = '#2a5ea9';
      buzzerCard.classList.add('border-b-4', 'border-mekong-blue');
    } else {
      buzzerStatus.textContent = 'Tắt';
      buzzerStatus.style.color = '#5d6775';
      buzzerIcon.style.backgroundColor = '#dbe6f5';
      buzzerCard.style.borderBottomColor = '#dbe6f5';
      buzzerCard.classList.remove('border-b-4', 'border-mekong-blue');
    }

    persistControlState({ buzzerOn: isOn });
  };

  const updateBuzzerDetectUi = (isOn) => {
    if (buzzerDetectToggle && buzzerDetectToggle.checked !== isOn) {
      buzzerDetectToggle.checked = isOn;
    }

    persistControlState({ buzzerDetectOn: isOn });
  };

  const updateMainDoorUi = (isOpen) => {
    if (!mainDoorCard || !mainDoorIcon || !mainDoorStatus || !mainDoorToggle) return;

    mainDoorToggle.setAttribute('aria-pressed', String(isOpen));
    mainDoorToggle.className = isOpen ? 'door-action-button is-open' : 'door-action-button';
    mainDoorToggle.innerHTML = isOpen
      ? '<i class="fa-solid fa-lock-open"></i>'
      : '<i class="fa-solid fa-lock"></i>';

    if (isOpen) {
      mainDoorStatus.textContent = 'Mở';
      mainDoorStatus.style.color = '#2a5ea9';
      mainDoorIcon.innerHTML = '<i class="fa-solid fa-lock-open"></i>';
      mainDoorIcon.style.backgroundColor = '#2a5ea9';
      mainDoorCard.style.borderBottomColor = '#2a5ea9';
    } else {
      mainDoorStatus.textContent = 'Đóng';
      mainDoorStatus.style.color = '#5d6775';
      mainDoorIcon.innerHTML = '<i class="fa-solid fa-lock"></i>';
      mainDoorIcon.style.backgroundColor = '#dbe6f5';
      mainDoorCard.style.borderBottomColor = '#dbe6f5';
    }

    persistControlState({ mainDoorOpen: isOpen });
  };

  const updateAutoDoorUi = (isOn) => {
    if (!autoDoorCard || !autoDoorIcon || !autoDoorStatus || !autoDoorToggle) return;

    if (autoDoorToggle.checked !== isOn) {
      autoDoorToggle.checked = isOn;
    }

    if (isOn) {
      autoDoorStatus.textContent = 'Bật';
      autoDoorStatus.style.color = '#2a5ea9';
      autoDoorIcon.style.backgroundColor = '#2a5ea9';
      autoDoorCard.style.borderBottomColor = '#2a5ea9';
    } else {
      autoDoorStatus.textContent = 'Tắt';
      autoDoorStatus.style.color = '#5d6775';
      autoDoorIcon.style.backgroundColor = '#dbe6f5';
      autoDoorCard.style.borderBottomColor = '#dbe6f5';
    }

    persistControlState({ autoDoorOn: isOn });
  };

  applyDashboardSnapshot(storedDashboardState);
  loadDashboardStateFromServer();
  isDashboardHydrating = false;

  if (fanToggle && fanSpeedSlider && fanSpeedValue) {
    fanSpeedValue.textContent = `${fanSpeedSlider.value}%`;
    updateFanUi(fanToggle.checked);

    fanToggle.addEventListener('change', () => {
      if (fanToggle.checked) {
        sendFanSpeed(fanSpeedSlider.value);
        sendFanState(true);
      } else {
        sendFanState(false);
      }

      updateFanUi(fanToggle.checked);
    });

    fanSpeedSlider.addEventListener('input', () => {
      fanSpeedValue.textContent = `${fanSpeedSlider.value}%`;
      updateFanUi(fanToggle.checked);
    });

    fanSpeedSlider.addEventListener('change', () => {
      sendFanSpeed(fanSpeedSlider.value);
      if (fanToggle.checked) {
        sendFanState(true);
      }
    });
  }

  if (fanSettingsButton && fanSettingsModal && fanSettingsOk) {
    fanSettingsButton.addEventListener('click', openFanSettings);
    fanFixedAdd?.addEventListener('click', () => {
      if (fanScheduleModeFixed) fanScheduleModeFixed.checked = true;
      fanFixedList?.append(createFanFixedRow({ action: 'off', hour: 14, minute: 30 }, true));
    });
    fanSettingsClose?.addEventListener('click', closeFanSettings);
    fanSettingsCancel?.addEventListener('click', closeFanSettings);
    fanSettingsOk.addEventListener('click', saveFanSettings);
    fanSettingsModal.addEventListener('click', (event) => {
      if (event.target === fanSettingsModal) {
        closeFanSettings();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && fanSettingsModal.classList.contains('is-visible')) {
        closeFanSettings();
      }
    });
  }

  [fanFixedAction, fanFixedTime].forEach((control) => {
    control?.addEventListener('focus', () => {
      if (fanScheduleModeFixed) fanScheduleModeFixed.checked = true;
    });
    control?.addEventListener('change', () => {
      if (fanScheduleModeFixed) fanScheduleModeFixed.checked = true;
    });
  });

  [fanDurationPreset, fanDurationCustom].forEach((control) => {
    control?.addEventListener('focus', () => {
      if (fanScheduleModeDuration) fanScheduleModeDuration.checked = true;
    });
    control?.addEventListener('change', () => {
      if (fanScheduleModeDuration) fanScheduleModeDuration.checked = true;
    });
  });

  if (fanDurationPreset && fanDurationCustom) {
    const syncFanDurationCustomState = () => {
      fanDurationCustom.disabled = fanDurationPreset.value !== 'custom';
      fanDurationCustom.classList.toggle('opacity-50', fanDurationCustom.disabled);
    };
    fanDurationPreset.addEventListener('change', syncFanDurationCustomState);
    syncFanDurationCustomState();
  }

  armFanSchedule();

  if (buzzerToggle) {
    updateBuzzerUi(buzzerToggle.checked);
    buzzerToggle.addEventListener('change', () => {
      updateBuzzerUi(buzzerToggle.checked);
      sendBuzzerState(buzzerToggle.checked);
    });
  }

  if (buzzerDetectToggle) {
    updateBuzzerDetectUi(buzzerDetectToggle.checked);
    buzzerDetectToggle.addEventListener('change', () => {
      updateBuzzerDetectUi(buzzerDetectToggle.checked);
      sendBuzzerDetectState(buzzerDetectToggle.checked);
    });
  }

  if (mainDoorToggle) {
    mainDoorToggle.addEventListener('click', () => {
      const nextState = mainDoorToggle.getAttribute('aria-pressed') !== 'true';
      updateMainDoorUi(nextState);
      sendMainDoorState(nextState);
    });
  }

  if (autoDoorToggle) {
    updateAutoDoorUi(autoDoorToggle.checked);
    autoDoorToggle.addEventListener('change', () => {
      updateAutoDoorUi(autoDoorToggle.checked);
      sendAutoDoorState(autoDoorToggle.checked);
    });
  }

  colorButtons.forEach((button) => {
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', button.classList.contains('is-selected') ? 'true' : 'false');
    button.addEventListener('click', () => setRgbColor(button));
  });

  rgbToggle?.addEventListener('change', () => {
    const selected = document.querySelector('.honeycomb-cell.is-selected');
    if (rgbToggle.checked && selected) {
      setRgbColor(selected);
    } else {
      updateRgbOffUi();
      sendRgbState(false);
      persistControlState({ rgbOn: false });
    }
  });

  const initialSelected = document.querySelector('.honeycomb-cell.is-selected');
  if (initialSelected) {
    setRgbColor(initialSelected, false);
  }
});

document.addEventListener('DOMContentLoaded', function() {
  const triggers = document.querySelectorAll('.help-trigger');
  const popover = document.getElementById('helpPopover');
  if (!triggers.length || !popover) return;

  const helpContents = {
    header: {
      title: 'Hướng dẫn nhanh',
      icon: 'fa-circle-info',
      items: [
        'Màu xanh là trạng thái đang hoạt động, màu xám là đang tắt hoặc chưa kích hoạt.',
        'Nhấn vào nút <code>?</code> ở từng card để xem chú thích đúng với chức năng của card đó.',
        'Các tip trong khung này được viết ngắn gọn để bạn xem nhanh ngay trên màn hình.',
      ],
    },
    status: {
      title: 'Chỉ số nhanh',
      icon: 'fa-gauge-high',
      items: [
        'Nhiệt độ, độ ẩm, ánh sáng và gas được cập nhật theo dữ liệu cảm biến.',
        'Nếu chỉ số đổi sang màu nâu, đó là dấu hiệu cần chú ý hơn mức bình thường.',
        'Bạn có thể xem chi tiết lịch sử ở biểu đồ phía dưới.',
      ],
    },
    'living-room': {
      title: 'Phòng khách',
      icon: 'fa-plug-circle-check',
      items: [
        'Đèn RGB: <code>D9 - D10</code>',
        'Khí gas: <code>A2</code>',
        'Ánh sáng: <code>A0</code>',
        'Còi: <code>D5 - D6</code>',
        'Module USB: <code>D7 - D8</code>',
        'PIR: <code>D3</code>',
        'Quạt: <code>V9</code>, tốc độ quạt <code>V10</code>',
        'Đèn: <code>V1</code>, màu đèn: <code>V2</code>',
      ],
    },
    light: {
      title: 'Điều khiển đèn',
      icon: 'fa-lightbulb',
      items: [
        'Bật hoặc tắt đèn bằng công tắc chính ở giữa card.',
        'Công tắc <code>Tự động</code> dùng để cho hệ thống tự xử lý theo ngữ cảnh.',
        'Giữ bố cục gọn để nhìn trạng thái thật rõ trên màn hình nhỏ.',
      ],
    },
    fan: {
      title: 'Điều khiển quạt',
      icon: 'fa-fan',
      items: [
        'Thanh trượt là nơi chỉnh tốc độ quạt theo từng nấc 10%.',
        'Khi quạt tắt, tốc độ vẫn được lưu để bật lại là dùng tiếp.',
        'Nếu tốc độ chưa đổi, hãy thử bật quạt trước rồi kéo thanh trượt.',
      ],
    },
    rgb: {
      title: 'LED RGB',
      icon: 'fa-palette',
      items: [
        'Chọn màu trực tiếp trên lưới tổ ong bên dưới.',
        'Ô đang chọn sẽ sáng nổi bật để bạn biết màu hiện hành.',
        'Nút <code>?</code> này chỉ là trợ giúp, không làm đổi màu đèn.',
      ],
    },
    'main-door': {
      title: 'Cửa chính',
      icon: 'fa-door-closed',
      items: [
        'Nhấn nút khóa/mở để đổi trạng thái cửa chính.',
        'Biểu tượng sẽ chuyển sang mở khóa khi cửa đang mở.',
        'Trạng thái luôn đồng bộ với dữ liệu MQTT của hệ thống.',
      ],
    },
    'auto-door': {
      title: 'Chìa khóa RFID',
      icon: 'fa-door-open',
      items: [
        'Bật để chìa khóa RFID xử lý theo logic của bộ điều khiển.',
        'Tắt khi muốn kiểm soát thủ công.',
        'Màu xanh là đang bật, màu xám là đang tắt.',
      ],
    },
    buzzer: {
      title: 'Buzzer',
      icon: 'fa-volume-high',
      items: [
        'Buzzer có thể dùng để phát âm cảnh báo khi phát hiện người.',
        'Nếu không cần âm báo, hãy tắt công tắc bên dưới.',
        'Tip: dùng ngắn âm lượng vừa phải để không gây ồn cho phòng.',
      ],
    },
    system: {
      title: 'Sơ đồ hệ thống',
      icon: 'fa-house-signal',
      items: [
        'Khung giữa trang là minh hoạ trạng thái ngôi nhà thông minh.',
        'Phần này giúp bạn nhìn nhanh tổng thể chứ không phải nút điều khiển.',
        'Các đường nét màu xanh giữ đúng tông chủ đề của dashboard.',
      ],
    },
    alerts: {
      title: 'Cảnh báo',
      icon: 'fa-bell',
      items: [
        'Danh sách này gom các cảnh báo mới nhất trong hệ thống.',
        'Khi thấy cảnh báo màu nâu, đó thường là nhóm cần chú ý hơn.',
        'Nếu danh sách dài, hãy cuộn xuống để xem đầy đủ.',
      ],
    },
    chart: {
      title: 'Biểu đồ nhiệt độ',
      icon: 'fa-chart-line',
      items: [
        'Chọn ngày bằng nút trước, hôm nay hoặc sau để xem dữ liệu khác nhau.',
        'Dropdown cho phép đổi mức chi tiết: giây, phút hoặc giờ.',
        'Điểm cuối cùng trên đường biểu đồ sẽ hiện nhãn giá trị nổi bật.',
      ],
    },
  };

  let activeTrigger = null;

  const closePopover = () => {
    popover.classList.remove('is-visible');
    popover.setAttribute('aria-hidden', 'true');
    popover.style.visibility = '';
    if (activeTrigger) {
      activeTrigger.setAttribute('aria-expanded', 'false');
    }
    activeTrigger = null;
  };

  const renderPopover = (key) => {
    const content = helpContents[key] || helpContents.header;
    const items = content.items.map((item) => `<li>${item}</li>`).join('');
    popover.innerHTML = `
      <div class="help-popover__title">
        <i class="fa-solid ${content.icon}"></i>
        <span>${content.title}</span>
      </div>
      <div class="help-popover__body">
        <ul>${items}</ul>
      </div>
    `;
  };

  const positionPopover = (trigger) => {
    popover.style.visibility = 'hidden';
    popover.classList.add('is-visible');

    const triggerRect = trigger.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const padding = 10;
    const gap = 12;
    const spaceAbove = triggerRect.top;
    const spaceBelow = window.innerHeight - triggerRect.bottom;
    let placement = spaceAbove >= popoverRect.height + gap || spaceAbove >= spaceBelow ? 'top' : 'bottom';
    let top = placement === 'top'
      ? triggerRect.top - popoverRect.height - gap
      : triggerRect.bottom + gap;
    let left = triggerRect.left + (triggerRect.width / 2) - (popoverRect.width / 2);

    if (placement === 'top' && top < padding) {
      placement = 'bottom';
      top = triggerRect.bottom + gap;
    } else if (placement === 'bottom' && top + popoverRect.height > window.innerHeight - padding) {
      placement = 'top';
      top = triggerRect.top - popoverRect.height - gap;
    }

    left = Math.max(padding, Math.min(left, window.innerWidth - popoverRect.width - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - popoverRect.height - padding));

    popover.dataset.placement = placement;
    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.visibility = 'visible';
  };

  const openPopover = (trigger) => {
    if (activeTrigger === trigger && popover.classList.contains('is-visible')) {
      closePopover();
      return;
    }

    triggers.forEach((button) => button.setAttribute('aria-expanded', 'false'));
    activeTrigger = trigger;
    trigger.setAttribute('aria-expanded', 'true');
    renderPopover(trigger.dataset.helpKey || 'header');
    positionPopover(trigger);
    popover.setAttribute('aria-hidden', 'false');
  };

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      openPopover(trigger);
    });
  });

  popover.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  document.addEventListener('click', (event) => {
    if (!popover.contains(event.target) && !event.target.closest('.help-trigger')) {
      closePopover();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePopover();
    }
  });

  window.addEventListener('resize', () => {
    if (activeTrigger) {
      positionPopover(activeTrigger);
    }
  });

  window.addEventListener('scroll', () => {
    if (activeTrigger) {
      positionPopover(activeTrigger);
    }
  }, true);

  closePopover();
});
