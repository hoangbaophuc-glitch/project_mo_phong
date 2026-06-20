#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <DHT.h>
#include "SSD1306Ascii.h"
#include "SSD1306AsciiWire.h"
#include <time.h>

const char* ssid = "Wokwi-GUEST";
const char* password = "";

String firebaseURL = "https://smartparking-d39a7-default-rtdb.asia-southeast1.firebasedatabase.app/";

#define DHTPIN 12
#define DHTTYPE DHT22
#define MQ_AOUT 34
#define LDR_AO 26
#define LDR_DO 25
#define OLED_SDA 18
#define OLED_SCL 5
#define OLED_ADDR 0x3C
#define LED_XANH 33
#define LED_DO 22
#define LED_TRANG 21
#define STEP_PIN 15
#define DIR_PIN 2

DHT dht(DHTPIN, DHTTYPE);
SSD1306AsciiWire oled;

float temp = 0, hum = 0;
int gasValue = 0, lightValue = 0, lightDigital = HIGH;
int gasLimit = 2000;
float tempLimit = 50.0;
int ledWhiteControl = 0;

bool doorOpened = false;
String status = "SAFE";

unsigned long lastDHT = 0;
unsigned long lastControl = 0;
unsigned long lastFirebase = 0;
unsigned long lastOled = 0;

const unsigned long DHT_TIME = 2000;
const unsigned long CONTROL_TIME = 1500;
const unsigned long FIREBASE_TIME = 1000;
const unsigned long OLED_TIME = 1000;

void stepMotor(int steps, bool dir) {
  digitalWrite(DIR_PIN, dir);

  for (int i = 0; i < steps; i++) {
    digitalWrite(STEP_PIN, HIGH);
    delayMicroseconds(800);
    digitalWrite(STEP_PIN, LOW);
    delayMicroseconds(800);
  }
}

void readControl() {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(firebaseURL + "control.json");

  int code = http.GET();

  if (code > 0) {
    String data = http.getString();

    int pLed = data.indexOf("\"ledWhite\":");
    int pGas = data.indexOf("\"gasLimit\":");
    int pTemp = data.indexOf("\"tempLimit\":");

    if (pLed >= 0) {
      ledWhiteControl = data.substring(pLed + 11).toInt();
    }

    if (pGas >= 0) {
      gasLimit = data.substring(pGas + 11).toInt();
    }

    if (pTemp >= 0) {
      tempLimit = data.substring(pTemp + 12).toFloat();
    }
  }

  http.end();
}

void sendSensor() {
  if (WiFi.status() != WL_CONNECTED) return;

  // --- LẤY THỜI GIAN THỰC ĐỂ TÍNH LATENCY ---
  struct timeval tv;
  gettimeofday(&tv, NULL);
  long long thoi_gian_gui_ms = (tv.tv_sec * 1000LL) + (tv.tv_usec / 1000);
  char timeStr[20];
  sprintf(timeStr, "%llu", thoi_gian_gui_ms); // Chuyển số quá lớn thành chuỗi an toàn
  // -----------------------------------------

  HTTPClient http;
  http.begin(firebaseURL + "sensor.json");
  http.addHeader("Content-Type", "application/json");

  String data = "{";
  data += "\"temperature\":" + String(temp) + ",";
  data += "\"humidity\":" + String(hum) + ",";
  data += "\"gas\":" + String(gasValue) + ",";
  data += "\"light\":" + String(lightValue) + ",";
  data += "\"status\":\"" + status + "\",";
  data += "\"ledWhite\":" + String(ledWhiteControl) + ",";
  data += "\"gasLimit\":" + String(gasLimit) + ",";
  data += "\"tempLimit\":" + String(tempLimit) + ","; // Lưu ý đã thêm dấu phẩy ở cuối dòng này
  data += "\"timestamp\":" + String(timeStr);         // <--- CHÈN BIẾN TIMESTAMP VÀO ĐÂY
  data += "}";

  int code = http.PUT(data);

  Serial.print("Firebase: ");
  Serial.println(code);

  http.end();
}

void updateSensor() {
  gasValue = analogRead(MQ_AOUT);
  lightValue = analogRead(LDR_AO);
  lightDigital = digitalRead(LDR_DO);
}

void updateDHT() {
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  if (!isnan(t) && !isnan(h)) {
    temp = t;
    hum = h;
  }
}

void updateLogic() {
  bool danger = false;

  if (gasValue >= gasLimit || temp >= tempLimit) {
    danger = true;
  }

  status = danger ? "DANGER" : "SAFE";

  digitalWrite(LED_XANH, danger ? LOW : HIGH);
  digitalWrite(LED_DO, danger ? HIGH : LOW);

  if (danger && doorOpened == false) {
    stepMotor(50, HIGH);
    doorOpened = true;
  }

  if (!danger && doorOpened == true) {
    stepMotor(50, LOW);
    doorOpened = false;
  }

  if (ledWhiteControl == 1 || lightDigital == LOW) {
    digitalWrite(LED_TRANG, HIGH);
  } else {
    digitalWrite(LED_TRANG, LOW);
  }
}

void updateOLED() {
  oled.clear();

  oled.println("SMART FIRE SYS");

  oled.print("Temp: ");
  oled.print(temp);
  oled.println(" C");

  oled.print("Hum : ");
  oled.print(hum);
  oled.println(" %");

  oled.print("Gas : ");
  oled.println(gasValue);

  oled.print("G.Lim: ");
  oled.println(gasLimit);

  oled.print("T.Lim: ");
  oled.println(tempLimit);

  oled.print("Status: ");
  oled.println(status);
}

void printSerial() {
  Serial.print("Temp: ");
  Serial.print(temp);
  Serial.print(" | Hum: ");
  Serial.print(hum);
  Serial.print(" | Gas: ");
  Serial.print(gasValue);
  Serial.print(" | Light: ");
  Serial.print(lightValue);
  Serial.print(" | GasLimit: ");
  Serial.print(gasLimit);
  Serial.print(" | TempLimit: ");
  Serial.print(tempLimit);
  Serial.print(" | Status: ");
  Serial.print(status);
  Serial.print(" | LED White: ");
  Serial.println(ledWhiteControl);
}

void setup() {
  Serial.begin(115200);

  dht.begin();

  pinMode(LED_XANH, OUTPUT);
  pinMode(LED_DO, OUTPUT);
  pinMode(LED_TRANG, OUTPUT);
  pinMode(LDR_DO, INPUT);
  pinMode(STEP_PIN, OUTPUT);
  pinMode(DIR_PIN, OUTPUT);

  Wire.begin(OLED_SDA, OLED_SCL);
  oled.begin(&Adafruit128x64, OLED_ADDR);
  oled.setFont(Adafruit5x7);
  oled.clear();

  oled.println("SMART FIRE");
  oled.println("CONNECT WIFI");

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print(".");
  }

  // --- CẤU HÌNH ĐỒNG BỘ THỜI GIAN NTP (GMT+7) ---
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("\nĐang dong bo thoi gian NTP");
  while (time(nullptr) < 100000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nDong bo thoi gian thanh cong!");
  // ----------------------------------------------

  oled.clear();
  oled.println("SMART FIRE");
  oled.println("WIFI READY");

  digitalWrite(LED_XANH, HIGH);
  digitalWrite(LED_DO, LOW);
  digitalWrite(LED_TRANG, LOW);
}

void loop() {
  unsigned long now = millis();

  updateSensor();
  updateLogic();

  if (now - lastDHT >= DHT_TIME) {
    lastDHT = now;
    updateDHT();
  }

  if (now - lastControl >= CONTROL_TIME) {
    lastControl = now;
    readControl();
  }

  if (now - lastFirebase >= FIREBASE_TIME) {
    lastFirebase = now;
    sendSensor();
  }

  if (now - lastOled >= OLED_TIME) {
    lastOled = now;
    updateOLED();
    printSerial();
  }
}