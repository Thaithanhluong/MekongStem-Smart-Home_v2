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
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  oled.fill(0); oled.show()
  oled.text(str('Hieu chinh'), 1-1, 1-1, 1); oled.show()
  oled.text(str('cam bien...'), 1-1, 10-1, 1); oled.show()
  await mq_A2.calibrate(1.210233)
  khi_gas = await mq_A2.readLPG()
  neopix.show(0, hex_to_rgb('#800080'))
  oled.fill(0); oled.show()
  oled.text(str('Xong'), 1-1, 10-1, 1); oled.show()
  await asleep_ms(1000)
  oled.fill(0); oled.show()

async def on_mqtt_msg_f_k_q_l(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  last_LED_state = msg
  if msg == '1':
    rgb_led_D9.show(0, hex_to_rgb(color))
  else:
    rgb_led_D9.show(0, hex_to_rgb('#000000'))
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/led-rgb', last_LED_state)

async def on_mqtt_msg_J_V_x_E(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  color = msg
  if last_LED_state == '1':
    rgb_led_D9.show(0, hex_to_rgb(color))

cfg = config.copy()

# Mô tả hàm này...
async def K_E1_BA_BFt_n_E1_BB_91i_Wifi():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  oled.text(str('Wifi connecting...'), 1-1, 1-1, 1); oled.show()
  await mqtt_client.connect()
  oled.fill(0); oled.show()
  oled.text(str('Wifi connected'), 1-1, 1-1, 1); oled.show()
  neopix.show(0, hex_to_rgb('#00ff00'))
  await asleep_ms(1000)

# Mô tả hàm này...
async def Kh_E1_BB_9Fi__C4_91_E1_BB_99ng():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  RFID = '1'
  AUTO_LIGHT = '0'
  last_LED_state = '0'
  buzzer_when_detect = '0'
  speed = '20'
  color = '#ff0000'
  neopix.show(0, hex_to_rgb('#ff0000'))
  await asleep_ms(1000)
  neopix.show(0, hex_to_rgb('#00ff00'))
  await asleep_ms(1000)
  neopix.show(0, hex_to_rgb('#000000'))

async def on_mqtt_msg_c_A_i_o(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  last_fan_state = msg
  if msg == '1':
    minifan_D4.write_analog(round(translate(speed, 0, 100, 0, 1023)))
  else:
    minifan_D4.write_analog(round(translate(0, 0, 100, 0, 1023)))
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/fan', last_fan_state)

async def on_mqtt_msg_y_z_p_e(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  speed = int((msg))
  if last_fan_state == '1':
    minifan_D4.write_analog(round(translate(speed, 0, 100, 0, 1023)))

async def on_mqtt_msg_O_N_P_T(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  light = msg
  if light == '1':
    usb_switch_D3.write_analog(round(translate(100, 0, 100, 0, 1023)))
  else:
    usb_switch_D3.write_analog(round(translate(0, 0, 100, 0, 1023)))
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/light', light)

# Mô tả hàm này...
async def Hi_E1_BB_83n_th_E1_BB_8B_ban__C4_91_E1_BA_A7u():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  _C3_81nh_s_C3_A1ng = light_A0.read_analog_percent()
  Nhi_E1_BB_87t__C4_91_E1_BB_99 = await dht20.atemperature()
  _C4_90_E1_BB_99__E1_BA_A9m = await dht20.ahumidity()
  oled.fill(0); oled.show()
  oled.text(str((''.join([str(x5) for x5 in ['Nhiet do: ', Nhi_E1_BB_87t__C4_91_E1_BB_99, '*C']]))), 1-1, 1-1, 1); oled.show()
  oled.text(str((''.join([str(x6) for x6 in ['Do am: ', _C4_90_E1_BB_99__E1_BA_A9m, '%']]))), 1-1, 15-1, 1); oled.show()
  oled.text(str((''.join([str(x7) for x7 in ['Anh sang:', _C3_81nh_s_C3_A1ng, '%']]))), 1-1, 30-1, 1); oled.show()
  oled.text(str((''.join([str(x8) for x8 in ['Khi gas:', khi_gas, 'ppm']]))), 1-1, 45-1, 1); oled.show()
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/sensor/light', _C3_81nh_s_C3_A1ng)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/sensor/temperature', Nhi_E1_BB_87t__C4_91_E1_BB_99)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/sensor/humidity', _C4_90_E1_BB_99__E1_BA_A9m)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/sensor/gas', khi_gas)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/led-rgb', last_LED_state)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/fan', last_fan_state)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/light', light)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/buzzer/detect', buzzer_when_detect)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/door/main', C_E1_BB_ADa)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/door/rfid', RFID)
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/light/auto', AUTO_LIGHT)

async def on_mqtt_msg_V_d_z_u(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  AUTO_LIGHT = msg
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/light/auto', AUTO_LIGHT)

async def on_mqtt_msg_R_Y_z_G(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  buzzer_when_detect = msg
  if buzzer_when_detect == '1':
    buzzer_when_detect = '1'
  else:
    buzzer_when_detect = '0'
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/buzzer/detect', buzzer_when_detect)

async def on_mqtt_msg_X_v_h_D(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
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
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/door/main', C_E1_BB_ADa)

async def on_mqtt_msg_k_x_E_F(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  ARE_U_HERE = msg
  if ARE_U_HERE == 'ARE U HERE':
    await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/device', 'HERE')
    print('HERE', end =' ')

async def on_mqtt_msg_r_E_x_W(topic, msg):
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  RFID = msg
  await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/door/rfid', RFID)
  print(RFID)

khi_gas = None
RFID = None
Nhi_E1_BB_87t__C4_91_E1_BB_99 = None
last_fan_state = None
speed = None
light = None
AUTO_LIGHT = None
buzzer_when_detect = None
C_E1_BB_ADa = None
ARE_U_HERE = None
last_LED_state = None
color = None
_C4_90_E1_BB_99__E1_BA_A9m = None
_C3_81nh_s_C3_A1ng = None
gas_alarm_active = False
pir_motion_active = False
mq_A2 = MQ2(pinData=A2_PIN)
oled = SSD1306_I2C()
servo_D2 = Pins(D2_PIN)
buzzer_D7 = Pins(D7_PIN)
rgb_led_D9 = RGBLed(D9_PIN, 4)
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/led-rgb/state', on_mqtt_msg_f_k_q_l))
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/led-rgb/color', on_mqtt_msg_J_V_x_E))
cfg['ssid'] = 'BNG Tech'
cfg['wifi_pw'] = 'bng@2025'
cfg['server'] = 'broker.emqx.io'
cfg['port'] = 1883
cfg['user'] = ''
cfg['password'] = ''

dht20 = DHT20()
minifan_D4 = Pins(D4_PIN)
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/fan/state', on_mqtt_msg_c_A_i_o))
pir_D5 = Pins(D5_PIN)
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/fan/speed', on_mqtt_msg_y_z_p_e))
usb_switch_D3 = Pins(D3_PIN)
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/light/state', on_mqtt_msg_O_N_P_T))
light_A0 = Pins(A0_PIN)
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/light/auto', on_mqtt_msg_V_d_z_u))
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/buzzer/detect', on_mqtt_msg_R_Y_z_G))
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/door/main', on_mqtt_msg_X_v_h_D))
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/device', on_mqtt_msg_k_x_E_F))
cfg['topics'].append(('mekongstem/smart-home/esp32s3-luong872/cmd/door/rfid', on_mqtt_msg_r_E_x_W))

def deinit():
  mqtt_client.close()

import yolo_uno
yolo_uno.deinit = deinit

async def task_on_event_u_F_P_I():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  while True:
    await asleep_ms(250)
    try:
      card_ok = rfid.scan_and_check("rfids_1")
    except OSError as e:
      print('RFID error:', e)
      await asleep_ms(1000)
      continue
    if card_ok:
      if RFID == '1':
        neopix.show(0, hex_to_rgb('#00ff00'))
        servo_D2.servo_write(100)
        buzzer_D7.write_analog(round(translate(70, 0, 100, 0, 1023)))
        await asleep_ms(100)
        buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))
        await asleep_ms(4000)
        servo_D2.servo_write(0)
    else:
      neopix.show(0, hex_to_rgb('#000000'))
      neopix.show(0, hex_to_rgb('#ff0000'))
      await asleep_ms(2000)
      neopix.show(0, hex_to_rgb('#000000'))

async def task_I_j_x_t():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng, gas_alarm_active
  while True:
    await asleep_ms(1000)
    khi_gas = round(await mq_A2.readLPG())
    if khi_gas > 200 and not gas_alarm_active:
      gas_alarm_active = True
      oled.fill(0); oled.show()
      oled.text(str('Phat hien'), 1-1, 1-1, 1); oled.show()
      oled.text(str('ro ri gas!!!!'), 1-1, 12-1, 1); oled.show()
      create_task(task_on_message_1())
    elif khi_gas <= 200:
      gas_alarm_active = False

async def task_on_message_1():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  for count in range(5):
    buzzer_D7.write_analog(round(translate(70, 0, 100, 0, 1023)))
    await asleep_ms(300)
    buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))
    await asleep_ms(300)
  oled.fill(0); oled.show()
  await Hi_E1_BB_83n_th_E1_BB_8B_ban__C4_91_E1_BA_A7u()
  neopix.show(0, hex_to_rgb('#000000'))

mqtt_client = MQTTClient(cfg); MQTTClient.DEBUG = True

async def task_N_h_S_S():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  while True:
    await asleep_ms(30000)
    Nhi_E1_BB_87t__C4_91_E1_BB_99 = await dht20.atemperature()
    _C4_90_E1_BB_99__E1_BA_A9m = await dht20.ahumidity()
    oled.fill(0); oled.show()
    oled.text(str((''.join([str(x) for x in ['Nhiet do: ', Nhi_E1_BB_87t__C4_91_E1_BB_99, '*C']]))), 1-1, 1-1, 1); oled.show()
    oled.text(str((''.join([str(x2) for x2 in ['Do am: ', _C4_90_E1_BB_99__E1_BA_A9m, '%']]))), 1-1, 15-1, 1); oled.show()
    oled.text(str((''.join([str(x3) for x3 in ['Anh sang:', _C3_81nh_s_C3_A1ng, '%']]))), 1-1, 30-1, 1); oled.show()
    oled.text(str((''.join([str(x4) for x4 in ['Khi gas:', khi_gas, 'ppm']]))), 1-1, 45-1, 1); oled.show()
    await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/sensor/light', _C3_81nh_s_C3_A1ng)
    await asleep_ms(500)
    await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/sensor/temperature', Nhi_E1_BB_87t__C4_91_E1_BB_99)
    await asleep_ms(500)
    await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/sensor/humidity', _C4_90_E1_BB_99__E1_BA_A9m)
    await asleep_ms(500)
    await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/sensor/gas', khi_gas)

async def task_on_event_R_g_c_l():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng, pir_motion_active
  while True:
    await asleep_ms(100)
    if (pir_D5.read_digital() == 1):
      if not pir_motion_active:
        pir_motion_active = True
        await mqtt_client.publish('mekongstem/smart-home/esp32s3-luong872/state/motion', 'DETECTED')
      if buzzer_when_detect == '1':
        buzzer_D7.write_analog(round(translate(70, 0, 100, 0, 1023)))
        await asleep_ms(300)
        buzzer_D7.write_analog(round(translate(0, 0, 100, 0, 1023)))
        await asleep_ms(300)
    else:
      pir_motion_active = False

async def task_F_y_v_l():
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
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
  global khi_gas, RFID, Nhi_E1_BB_87t__C4_91_E1_BB_99, last_fan_state, speed, light, AUTO_LIGHT, buzzer_when_detect, C_E1_BB_ADa, ARE_U_HERE, last_LED_state, color, _C4_90_E1_BB_99__E1_BA_A9m, _C3_81nh_s_C3_A1ng
  print('App started')
  print('Bắt đầu khởi động')
  await Kh_E1_BB_9Fi__C4_91_E1_BB_99ng()
  print('Đã khởi động xong')
  print('Bắt đầu kết nối wifi và Broker')
  await K_E1_BA_BFt_n_E1_BB_91i_Wifi()
  print('Đã kết nối wifi và Broker')
  print('Bắt đều hiệu chỉnh cảm biến khí Gas')
  await Hi_E1_BB_87u_ch_E1_BB_89nh_c_E1_BA_A3m_bi_E1_BA_BFn_gas()
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
