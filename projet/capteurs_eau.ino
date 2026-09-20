/*
  Projet: Surveillance de la qualité de l'eau potable
  Lit 4 capteurs (température DS18B20, turbidité SEN0189, TDS Gravity, pH)
  et envoie les valeurs en JSON sur le port série USB vers le Raspberry Pi.

  Câblage:
    DS18B20   -> D2  (+ résistance pull-up 4.7kΩ entre DATA et 5V)
    Turbidité -> A0
    TDS       -> A1
    pH        -> A2
*/

#include <OneWire.h>
#include <DallasTemperature.h>

// ---------- Configuration ----------
#define ONE_WIRE_PIN   2
#define TURBIDITY_PIN  A0
#define TDS_PIN        A1
#define PH_PIN         A2

#define VREF           5.0    // tension de référence de l'Arduino Mega
#define ADC_RES        1024.0 // résolution 10 bits

// Calibration du pH — À AJUSTER avec tes solutions tampon pH 4.0 / pH 7.0
// Formule linéaire: pH = pente * tension + offset
float phSlope  = -5.70;
float phOffset = 21.34;

// Intervalle entre deux envois (ms)
const unsigned long INTERVAL_MS = 2000;
unsigned long lastSend = 0;

OneWire oneWire(ONE_WIRE_PIN);
DallasTemperature tempSensor(&oneWire);

void setup() {
  Serial.begin(9600);
  tempSensor.begin();
}

void loop() {
  unsigned long now = millis();
  if (now - lastSend >= INTERVAL_MS) {
    lastSend = now;
    envoyerLectures();
  }
}

void envoyerLectures() {
  float temperature = lireTemperature();
  float turbidite    = lireTurbidite();
  float tds          = lireTDS(temperature);
  float ph            = lirePH();

  // Envoi en JSON, une ligne par lecture — facile à parser côté Python (pyserial)
  Serial.print("{");
  Serial.print("\"temperature\":"); Serial.print(temperature, 2); Serial.print(",");
  Serial.print("\"turbidity\":");   Serial.print(turbidite, 2);   Serial.print(",");
  Serial.print("\"tds\":");         Serial.print(tds, 2);         Serial.print(",");
  Serial.print("\"ph\":");          Serial.print(ph, 2);
  Serial.println("}");
}

// ---------- Température (DS18B20) ----------
float lireTemperature() {
  tempSensor.requestTemperatures();
  float t = tempSensor.getTempCByIndex(0);
  if (t == DEVICE_DISCONNECTED_C) {
    return -127.0; // valeur d'erreur si le capteur ne répond pas
  }
  return t;
}

// ---------- Turbidité (SEN0189) ----------
// Formule DFRobot approximative: convertit la tension en NTU
float lireTurbidite() {
  int raw = analogRead(TURBIDITY_PIN);
  float voltage = raw * (VREF / ADC_RES);

  float ntu;
  if (voltage < 2.5) {
    ntu = 3000; // eau très trouble, hors plage de mesure fiable
  } else {
    ntu = -1120.4 * sq(voltage) + 5742.3 * voltage - 4353.8;
    if (ntu < 0) ntu = 0;
  }
  return ntu;
}

// ---------- TDS (Gravity Analog TDS) ----------
// Formule officielle DFRobot, compensée en température
float lireTDS(float temperatureC) {
  int raw = analogRead(TDS_PIN);
  float voltage = raw * (VREF / ADC_RES);

  float compensationCoefficient = 1.0 + 0.02 * (temperatureC - 25.0);
  float compensatedVoltage = voltage / compensationCoefficient;

  float tdsValue = (133.42 * pow(compensatedVoltage, 3)
                     - 255.86 * sq(compensatedVoltage)
                     + 857.39 * compensatedVoltage) * 0.5;
  if (tdsValue < 0) tdsValue = 0;
  return tdsValue; // en ppm
}

// ---------- pH ----------
float lirePH() {
  // Moyenne sur plusieurs lectures pour stabiliser le signal
  long somme = 0;
  const int nbLectures = 10;
  for (int i = 0; i < nbLectures; i++) {
    somme += analogRead(PH_PIN);
    delay(10);
  }
  float raw = somme / (float)nbLectures;
  float voltage = raw * (VREF / ADC_RES);

  float ph = phSlope * voltage + phOffset;
  return ph;
}
