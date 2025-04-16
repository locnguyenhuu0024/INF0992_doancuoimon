#include <ESP8266WiFi.h>

extern "C" {
  #include "user_interface.h"
}

const char *password = "12345678LT";

void setup() {
  Serial.begin(115200);
  Serial.println("Configuring access point...");

  char ssid[64];
  sprintf(ssid, "CONGNGHEIOT");
  WiFi.softAP(ssid, password);

  IPAddress myIP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(myIP);
}

void loop() {
  Serial.printf("Stations connected = %d\n", WiFi.softAPgetStationNum());

  struct station_info *stat_info;
  struct ip4_addr *IPaddress;
  uint8_t *macaddr;

  stat_info = wifi_softap_get_station_info();
  Serial.println("Connected stations:");
  while (stat_info != NULL) {
    IPaddress = &stat_info->ip;
    macaddr = stat_info->bssid;
    Serial.printf("IP: %d.%d.%d.%d, MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                  IPaddress->addr & 0xFF,
                  (IPaddress->addr >> 8) & 0xFF,
                  (IPaddress->addr >> 16) & 0xFF,
                  (IPaddress->addr >> 24) & 0xFF,
                  macaddr[0], macaddr[1], macaddr[2],
                  macaddr[3], macaddr[4], macaddr[5]);
    stat_info = STAILQ_NEXT(stat_info, next);
  }
  wifi_softap_free_station_info(); // free memory

  delay(5000);
}
