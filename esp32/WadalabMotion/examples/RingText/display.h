// 丸液晶 GC9A01（1.28 インチ、240×240、SPI）を LovyanGFX で使う設定。
// ESP32-C3 SuperMini での配線：SCL=GPIO4, SDA=GPIO6, CS=GPIO7, DC=GPIO5, RST=GPIO20, VCC=3.3V, GND=GND（BL なし＝常に点灯）
// ほかの液晶やピンで使うときは、ここを書き換える。
#pragma once
#define LGFX_USE_V1
#include <LovyanGFX.hpp>
class LGFX : public lgfx::LGFX_Device {
  lgfx::Panel_GC9A01 panel;
  lgfx::Bus_SPI bus;
public:
  LGFX() {
    auto b = bus.config();
    b.spi_host = SPI2_HOST; b.spi_mode = 0; b.freq_write = 80000000; b.freq_read = 16000000;   // 80MHz で乱れるなら 40MHz に
    b.pin_sclk = 4; b.pin_mosi = 6; b.pin_miso = -1; b.pin_dc = 5;
    b.dma_channel = SPI_DMA_CH_AUTO;
    bus.config(b); panel.setBus(&bus);
    auto p = panel.config();
    p.pin_cs = 7; p.pin_rst = 20; p.pin_busy = -1;
    p.panel_width = 240; p.panel_height = 240; p.invert = true; p.rgb_order = false;
    panel.config(p);
    setPanel(&panel);
  }
};
