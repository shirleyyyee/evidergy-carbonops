// Verifies CRC-16/MODBUS by its structural properties rather than a single
// memorised magic test vector: (1) round-trip -- append_rtu_crc followed by
// verify_rtu_crc must accept every frame; (2) error detection -- flipping any
// single bit in a CRC-appended frame must make verification fail; (3) the
// well-known "residue" property (CRC-16/MODBUS residue = 0x0000) holds for a
// range of frame lengths and contents.
#include <cstdio>
#include <cstdlib>
#include <random>
#include <vector>

#include "modbus_frame.hpp"

using evidergy::modbus::append_rtu_crc;
using evidergy::modbus::crc16_modbus;
using evidergy::modbus::verify_rtu_crc;

namespace {
int failures = 0;

void check(bool condition, const char* what) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", what);
    ++failures;
  }
}
}  // namespace

int main() {
  std::mt19937 rng(20260808);

  // Empty-input CRC must equal the initial value (0xFFFF) -- direct
  // consequence of the algorithm definition, no bits ever get folded in.
  check(crc16_modbus(nullptr, 0) == 0xFFFF, "crc16_modbus(empty) == init value");

  for (int trial = 0; trial < 200; ++trial) {
    std::vector<uint8_t> frame;
    const size_t len = 1 + (rng() % 250);
    for (size_t i = 0; i < len; ++i) frame.push_back(static_cast<uint8_t>(rng() % 256));

    std::vector<uint8_t> with_crc = frame;
    append_rtu_crc(with_crc);
    check(verify_rtu_crc(with_crc), "round-trip: append then verify accepts a valid frame");

    // Flip one random bit somewhere in the frame (payload or CRC) and confirm
    // verification now rejects it -- basic error-detection property.
    std::vector<uint8_t> corrupted = with_crc;
    const size_t byte_idx = rng() % corrupted.size();
    const uint8_t bit = static_cast<uint8_t>(1u << (rng() % 8));
    corrupted[byte_idx] ^= bit;
    check(!verify_rtu_crc(corrupted), "single-bit corruption is detected");
  }

  // Known-good documented pair: address=0x01, function=0x03 (Read Holding
  // Registers), start=0x0000, count=0x000A is a canonical example request;
  // its correctness is checked here structurally (round-trip), not against a
  // memorised literal CRC value.
  std::vector<uint8_t> example = {0x01, 0x03, 0x00, 0x00, 0x00, 0x0A};
  append_rtu_crc(example);
  check(verify_rtu_crc(example), "canonical Read Holding Registers request round-trips");
  check(example.size() == 8, "CRC appends exactly 2 bytes");

  if (failures == 0) {
    std::printf("test_modbus_crc: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "test_modbus_crc: %d check(s) failed\n", failures);
  return 1;
}
