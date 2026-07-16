from rfid import *
import math
from MQ2 import *
from ssd1306 import *
from pins import *
from yolo_uno import *
from mqtt_as import MQTTClient, config
from dht20 import *

# Mô tả hàm này...
async def Hi_E1_BB_87u_ch_E1_BB_89nh_c_E1_BA_A3m_bi_E1_BA_BFn_gas():
  global card_ok, khi_gas, pir_motion_active, last_fan_state, Nhi_E1_BB_87t__C4_91_E1_BB_99, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, RFID, last_LED_state, color, gas_alarm_active, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  oled.fill(0); oled.show()
  oled.text(str('Hieu chinh'), 1-1, 1-1, 1); oled.show()
  oled.text(str('cam bien...'), 1-1, 10-1, 1); oled.show()
  await mq_A2.calibrate(-1)
  mq_A2.mode(MQ2.STRATEGY_FAST)
  khi_gas = await mq_A2.readLPG()
  neopix.show(0, hex_to_rgb('#800080'))
  oled.fill(0); oled.show()
  oled.text(str('Xong'), 1-1, 10-1, 1); oled.show()
  await asleep_ms(1000)
  oled.fill(0); oled.show()

async def on_mqtt_msg_f_k_q_l(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  last_LED_state = msg
  if msg == '1':
    rgb_led_D9.show(0, hex_to_rgb(color))
  else:
    rgb_led_D9.show(0, hex_to_rgb('#000000'))

async def on_mqtt_msg_J_V_x_E(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  color = msg
  if last_LED_state == '1':
    rgb_led_D9.show(0, hex_to_rgb(color))

cfg = config.copy()
MQTT_USER = 'luong873004'
TOPIC_LIGHT_STATE = 'V1'
TOPIC_RGB_COLOR = 'V2'
TOPIC_RGB_STATE = 'V3'
TOPIC_TEMPERATURE = 'V4'
TOPIC_HUMIDITY = 'V5'
TOPIC_LIGHT_SENSOR = 'V6'
TOPIC_GAS = 'V7'
TOPIC_MOTION = 'V8'
TOPIC_FAN_STATE = 'V9'
TOPIC_FAN_SPEED = 'V10'
TOPIC_AUTO_LIGHT = 'V12'
TOPIC_MOTION_LIGHT = 'V13'
TOPIC_MAIN_DOOR = 'V14'
TOPIC_RFID_DOOR = 'V15'
TOPIC_BUZZER = 'V16'
TOPIC_DEVICE = 'V20'
RFID_SCAN_INTERVAL_MS = 75
RFID_ERROR_RETRY_MS = 500
RFID_OPEN_HOLD_MS = 4000
RFID_BEEP_MS = 100
GAS_READ_INTERVAL_MS = 1000

async def read_dht20_safe():
  global Nhi_E1_BB_87t__C4_91_E1_BB_99, _C4_90_E1_BB_99__E1_BA_A9m
  for retry in range(5):
    try:
      temperature = await dht20.atemperature()
      humidity = await dht20.ahumidity()
      Nhi_E1_BB_87t__C4_91_E1_BB_99 = temperature
      _C4_90_E1_BB_99__E1_BA_A9m = humidity
      return True
    except OSError as e:
      print('DHT20 error:', e)
      if retry < 4:
        await asleep_ms(700)
  return False

def update_gas_oled():
  if gas_alarm_active:
    oled.fill(0); oled.show()
    oled.text(str('Phat hien'), 1-1, 1-1, 1); oled.show()
    oled.text(str('ro ri gas!!!!'), 1-1, 12-1, 1); oled.show()
    oled.text(str((''.join([str(x) for x in ['Khi gas:', khi_gas, 'ppm']]))), 1-1, 45-1, 1); oled.show()
  else:
    oled.fill_rect(0, 44, 128, 10, 0)
    oled.text(str((''.join([str(x) for x in ['Khi gas:', khi_gas, 'ppm']]))), 1-1, 45-1, 1); oled.show()

async def publish_gas_safe():
  try:
    await mqtt_client.publish(TOPIC_GAS, khi_gas)
  except Exception as e:
    print('Gas MQTT publish error:', e)

# Mô tả hàm này...
async def K_E1_BA_BFt_n_E1_BB_91i_Wifi():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  oled.text(str('Wifi connecting...'), 1-1, 1-1, 1); oled.show()
  await mqtt_client.connect()
  oled.fill(0); oled.show()
  oled.text(str('Wifi connected'), 1-1, 1-1, 1); oled.show()
  neopix.show(0, hex_to_rgb('#00ff00'))
  await asleep_ms(1000)

# Mô tả hàm này...
async def Kh_E1_BB_9Fi__C4_91_E1_BB_99ng():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  RFID = '1'
  AUTO_LIGHT = '0'
  last_LED_state = '0'
  auto_light_when_detect = '0'
  speed = '20'
  color = '#ff0000'
  neopix.show(0, hex_to_rgb('#ff0000'))
  await asleep_ms(1000)
  neopix.show(0, hex_to_rgb('#00ff00'))
  await asleep_ms(1000)
  neopix.show(0, hex_to_rgb('#000000'))

async def on_mqtt_msg_c_A_i_o(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  last_fan_state = msg
  if msg == '1':
    minifan_D4.write_analog(round(translate(speed, 0, 100, 0, 1023)))
  else:
    minifan_D4.write_analog(round(translate(0, 0, 100, 0, 1023)))

async def on_mqtt_msg_y_z_p_e(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  speed = int((msg))
  if last_fan_state == '1':
    minifan_D4.write_analog(round(translate(speed, 0, 100, 0, 1023)))

async def on_mqtt_msg_O_N_P_T(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  light = msg
  if light == '1':
    usb_switch_D3.write_analog(round(translate(100, 0, 100, 0, 1023)))
  else:
    usb_switch_D3.write_analog(round(translate(0, 0, 100, 0, 1023)))

# Mô tả hàm này...
async def Hi_E1_BB_83n_th_E1_BB_8B_ban__C4_91_E1_BA_A7u():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  _C3_81nh_s_C3_A1ng = light_A0.read_analog_percent()
  dht20_ok = await read_dht20_safe()
  oled.fill(0); oled.show()
  if Nhi_E1_BB_87t__C4_91_E1_BB_99 is None or _C4_90_E1_BB_99__E1_BA_A9m is None:
    oled.text(str('DHT20 loi'), 1-1, 1-1, 1); oled.show()
    oled.text(str('Thu lai sau'), 1-1, 15-1, 1); oled.show()
  else:
    oled.text(str((''.join([str(x5) for x5 in ['Nhiet do: ', Nhi_E1_BB_87t__C4_91_E1_BB_99, '*C']]))), 1-1, 1-1, 1); oled.show()
    oled.text(str((''.join([str(x6) for x6 in ['Do am: ', _C4_90_E1_BB_99__E1_BA_A9m, '%']]))), 1-1, 15-1, 1); oled.show()
  oled.text(str((''.join([str(x7) for x7 in ['Anh sang:', _C3_81nh_s_C3_A1ng, '%']]))), 1-1, 30-1, 1); oled.show()
  oled.text(str((''.join([str(x8) for x8 in ['Khi gas:', khi_gas, 'ppm']]))), 1-1, 45-1, 1); oled.show()
  await mqtt_client.publish(TOPIC_LIGHT_SENSOR, _C3_81nh_s_C3_A1ng)
  if dht20_ok:
    await mqtt_client.publish(TOPIC_TEMPERATURE, Nhi_E1_BB_87t__C4_91_E1_BB_99)
    await mqtt_client.publish(TOPIC_HUMIDITY, _C4_90_E1_BB_99__E1_BA_A9m)
  await mqtt_client.publish(TOPIC_GAS, khi_gas)
  await mqtt_client.publish(TOPIC_RGB_STATE, last_LED_state)
  await mqtt_client.publish(TOPIC_FAN_STATE, last_fan_state)
  await mqtt_client.publish(TOPIC_LIGHT_STATE, light)
  await mqtt_client.publish(TOPIC_MOTION_LIGHT, auto_light_when_detect)
  await mqtt_client.publish(TOPIC_MAIN_DOOR, C_E1_BB_ADa)
  await mqtt_client.publish(TOPIC_RFID_DOOR, RFID)
  await mqtt_client.publish(TOPIC_AUTO_LIGHT, AUTO_LIGHT)

async def publish_current_state():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  await mqtt_client.publish(TOPIC_DEVICE, 'HERE')
  await asleep_ms(120)
  _C3_81nh_s_C3_A1ng = light_A0.read_analog_percent()
  await read_dht20_safe()
  snapshot = [
    (TOPIC_LIGHT_SENSOR, _C3_81nh_s_C3_A1ng),
    (TOPIC_TEMPERATURE, Nhi_E1_BB_87t__C4_91_E1_BB_99),
    (TOPIC_HUMIDITY, _C4_90_E1_BB_99__E1_BA_A9m),
    (TOPIC_GAS, khi_gas),
    (TOPIC_RGB_COLOR, color),
    (TOPIC_RGB_STATE, last_LED_state),
    (TOPIC_FAN_STATE, last_fan_state),
    (TOPIC_FAN_SPEED, speed),
    (TOPIC_LIGHT_STATE, light),
    (TOPIC_MOTION_LIGHT, auto_light_when_detect),
    (TOPIC_MAIN_DOOR, C_E1_BB_ADa),
    (TOPIC_RFID_DOOR, RFID),
    (TOPIC_AUTO_LIGHT, AUTO_LIGHT),
  ]
  for item in snapshot:
    if item[1] != None:
      await mqtt_client.publish(item[0], item[1])
      await asleep_ms(120)

async def on_mqtt_msg_V_d_z_u(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  AUTO_LIGHT = msg

async def on_mqtt_msg_motion_light(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  if msg == '1':
    auto_light_when_detect = '1'
  else:
    auto_light_when_detect = '0'

async def on_mqtt_msg_buzzer_manual(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  if msg == '1':
    buzzer_D7.write_analog(round(translate(70, 0, 100, 0, 1023)))
  else:
    buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))

async def on_mqtt_msg_X_v_h_D(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  C_E1_BB_ADa = msg
  if C_E1_BB_ADa == '1':
    servo_D2.servo_write(100)
    buzzer_D7.write_analog(round(translate(70, 0, 100, 0, 1023)))
    await asleep_ms(100)
    buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))
  else:
    servo_D2.servo_write(0)
    buzzer_D7.write_analog(round(translate(70, 0, 100, 0, 1023)))
    await asleep_ms(100)
    buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))

async def on_mqtt_msg_k_x_E_F(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  ARE_U_HERE = msg
  if ARE_U_HERE == 'ARE U HERE':
    await mqtt_client.publish(TOPIC_DEVICE, 'HERE')
    print('HERE', end =' ')
  elif ARE_U_HERE == 'SYNC_REQUEST':
    await publish_current_state()

async def on_mqtt_msg_r_E_x_W(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  RFID = msg
  print(RFID)

khi_gas = None
RFID = None
Nhi_E1_BB_87t__C4_91_E1_BB_99 = None
last_fan_state = None
speed = None
light = None
AUTO_LIGHT = None
auto_light_when_detect = None
C_E1_BB_ADa = None
ARE_U_HERE = None
last_LED_state = None
color = None
_C4_90_E1_BB_99__E1_BA_A9m = None
_C3_81nh_s_C3_A1ng = None
gas_alarm_active = False
pir_motion_active = False
rfid_card_active = False
mq_A2 = MQ2(pinData=A2_PIN)
oled = SSD1306_I2C()
servo_D2 = Pins(D2_PIN)
buzzer_D7 = Pins(D7_PIN)
rgb_led_D9 = RGBLed(D9_PIN, 4)
cfg['topics'].append((TOPIC_RGB_STATE, on_mqtt_msg_f_k_q_l))
cfg['topics'].append((TOPIC_RGB_COLOR, on_mqtt_msg_J_V_x_E))
cfg['ssid'] = 'BNG Tech'
cfg['wifi_pw'] = 'bng@2025'
cfg['server'] = 'mqtt.ohstem.vn'
cfg['port'] = 1883
cfg['user'] = MQTT_USER
cfg['password'] = 'mekongstem@2025'

dht20 = DHT20()
minifan_D4 = Pins(D4_PIN)
cfg['topics'].append((TOPIC_FAN_STATE, on_mqtt_msg_c_A_i_o))
pir_D5 = Pins(D5_PIN)
cfg['topics'].append((TOPIC_FAN_SPEED, on_mqtt_msg_y_z_p_e))
usb_switch_D3 = Pins(D3_PIN)
cfg['topics'].append((TOPIC_LIGHT_STATE, on_mqtt_msg_O_N_P_T))
light_A0 = Pins(A0_PIN)
cfg['topics'].append((TOPIC_AUTO_LIGHT, on_mqtt_msg_V_d_z_u))
cfg['topics'].append((TOPIC_MOTION_LIGHT, on_mqtt_msg_motion_light))
cfg['topics'].append((TOPIC_MAIN_DOOR, on_mqtt_msg_X_v_h_D))
cfg['topics'].append((TOPIC_DEVICE, on_mqtt_msg_k_x_E_F))
cfg['topics'].append((TOPIC_RFID_DOOR, on_mqtt_msg_r_E_x_W))
cfg['topics'].append((TOPIC_BUZZER, on_mqtt_msg_buzzer_manual))

def deinit():
  mqtt_client.close()

import yolo_uno
yolo_uno.deinit = deinit

async def task_on_event_u_F_P_I():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng, rfid_card_active
  while True:
    try:
      card_ok = rfid.scan_and_check("rfids_1")
    except OSError as e:
      print('RFID error:', e)
      await asleep_ms(RFID_ERROR_RETRY_MS)
      continue

    if not card_ok:
      rfid_card_active = False
      neopix.show(0, hex_to_rgb('#000000'))
      await asleep_ms(RFID_SCAN_INTERVAL_MS)
      continue

    if RFID == '1' and not rfid_card_active:
      rfid_card_active = True
      neopix.show(0, hex_to_rgb('#00ff00'))
      servo_D2.servo_write(100)
      C_E1_BB_ADa = '1'
      buzzer_D7.write_analog(round(translate(70, 0, 100, 0, 1023)))
      await asleep_ms(RFID_BEEP_MS)
      buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))
      await mqtt_client.publish(TOPIC_MAIN_DOOR, C_E1_BB_ADa)
      await asleep_ms(RFID_OPEN_HOLD_MS)
      servo_D2.servo_write(0)
      C_E1_BB_ADa = '0'
      await mqtt_client.publish(TOPIC_MAIN_DOOR, C_E1_BB_ADa)
      neopix.show(0, hex_to_rgb('#000000'))

    await asleep_ms(RFID_SCAN_INTERVAL_MS)

async def task_I_j_x_t():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng, gas_alarm_active
  while True:
    await asleep_ms(GAS_READ_INTERVAL_MS)
    khi_gas = round(await mq_A2.readLPG())
    if khi_gas > 200 and not gas_alarm_active:
      gas_alarm_active = True
      create_task(task_on_message_1())
    elif khi_gas <= 200:
      gas_alarm_active = False
      buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))
    update_gas_oled()
    await publish_gas_safe()

async def task_on_message_1():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng, gas_alarm_active
  while gas_alarm_active:
    buzzer_D7.write_analog(round(translate(70, 0, 100, 0, 1023)))
    await asleep_ms(300)
    buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))
    await asleep_ms(300)
  buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))
  if not gas_alarm_active:
    oled.fill(0); oled.show()
    await Hi_E1_BB_83n_th_E1_BB_8B_ban__C4_91_E1_BA_A7u()
    neopix.show(0, hex_to_rgb('#000000'))

mqtt_client = MQTTClient(cfg); MQTTClient.DEBUG = True

async def task_N_h_S_S():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  while True:
    await asleep_ms(30000)
    dht20_ok = await read_dht20_safe()
    oled.fill(0); oled.show()
    if Nhi_E1_BB_87t__C4_91_E1_BB_99 is None or _C4_90_E1_BB_99__E1_BA_A9m is None:
      oled.text(str('DHT20 loi'), 1-1, 1-1, 1); oled.show()
      oled.text(str('Thu lai sau'), 1-1, 15-1, 1); oled.show()
    else:
      oled.text(str((''.join([str(x) for x in ['Nhiet do: ', Nhi_E1_BB_87t__C4_91_E1_BB_99, '*C']]))), 1-1, 1-1, 1); oled.show()
      oled.text(str((''.join([str(x2) for x2 in ['Do am: ', _C4_90_E1_BB_99__E1_BA_A9m, '%']]))), 1-1, 15-1, 1); oled.show()
    oled.text(str((''.join([str(x3) for x3 in ['Anh sang:', _C3_81nh_s_C3_A1ng, '%']]))), 1-1, 30-1, 1); oled.show()
    oled.text(str((''.join([str(x4) for x4 in ['Khi gas:', khi_gas, 'ppm']]))), 1-1, 45-1, 1); oled.show()
    await mqtt_client.publish(TOPIC_LIGHT_SENSOR, _C3_81nh_s_C3_A1ng)
    if dht20_ok:
      await asleep_ms(500)
      await mqtt_client.publish(TOPIC_TEMPERATURE, Nhi_E1_BB_87t__C4_91_E1_BB_99)
      await asleep_ms(500)
      await mqtt_client.publish(TOPIC_HUMIDITY, _C4_90_E1_BB_99__E1_BA_A9m)
async def task_on_event_R_g_c_l():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng, pir_motion_active
  while True:
    await asleep_ms(100)
    if (pir_D5.read_digital() == 1):
      if not pir_motion_active:
        pir_motion_active = True
        await mqtt_client.publish(TOPIC_MOTION, 'DETECTED')
      if auto_light_when_detect == '1' and light != '1':
        light = '1'
        usb_switch_D3.write_analog(round(translate(100, 0, 100, 0, 1023)))
        await mqtt_client.publish(TOPIC_LIGHT_STATE, light)
    else:
      pir_motion_active = False

async def task_F_y_v_l():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  while True:
    await asleep_ms(5000)
    if AUTO_LIGHT == '1':
      _C3_81nh_s_C3_A1ng = light_A0.read_analog_percent()
      if _C3_81nh_s_C3_A1ng < 50:
        usb_switch_D3.write_analog(round(translate(100, 0, 100, 0, 1023)))
      elif _C3_81nh_s_C3_A1ng > 70:
        usb_switch_D3.write_analog(round(translate(0, 0, 100, 0, 1023)))
    else:
      AUTO_LIGHT = '0'

async def setup():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, auto_light_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  print('App started')
  print('Bắt đầu khởi động')
  await Kh_E1_BB_9Fi__C4_91_E1_BB_99ng()
  print('Đã khởi động xong')
  print('Bắt đầu kết nối wifi và Broker')
  await K_E1_BA_BFt_n_E1_BB_91i_Wifi()
  print('Đã kết nối wifi và Broker')
  print('Bắt đều hiệu chỉnh cảm biến khí Gas')
  await Hi_E1_BB_87u_ch_E1_BB_89nh_c_E1_BA_A3m_bi_E1_BA_BFn_gas()
  await asleep_ms(2000)
  print('Đã hiệu chỉnh cảm biến Gas')
  await Hi_E1_BB_83n_th_E1_BB_8B_ban__C4_91_E1_BA_A7u()
  print('Đã hiển thị dữ liệu ban đầu')

  create_task(task_on_event_u_F_P_I())
  create_task(task_I_j_x_t())
  create_task(task_N_h_S_S())
  create_task(task_on_event_R_g_c_l())
  create_task(task_F_y_v_l())

async def main():
  await setup()
  while True:
    await asleep_ms(100)

run_loop(main())
