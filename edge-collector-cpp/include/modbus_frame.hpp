// Modbus TCP (MBAP) framing and Modbus RTU CRC-16, implemented from the
// public Modbus Application Protocol V1.1b3 and Modbus over Serial Line V1.02
// specifications. This is a real, standards-conformant implementation of the
// framing layer only -- not a full Modbus master/slave stack.
#pragma once

#include <cstdint>
#include <optional>
#include <stdexcept>
#include <vector>

namespace periscope::modbus {

// --- CRC-16/MODBUS (used by Modbus RTU on serial links) ---------------------
// Polynomial 0xA001 (reflected form of 0x8005), initial value 0xFFFF, no
// final XOR. This is the exact algorithm defined by the Modbus specification;
// verified in tests against the round-trip / error-detection properties of
// the algorithm itself rather than a single memorised magic constant.
uint16_t crc16_modbus(const uint8_t* data, size_t length);

// Appends the 2-byte little-endian CRC to `frame` in place (RTU convention).
void append_rtu_crc(std::vector<uint8_t>& frame);

// Returns true if the trailing 2 bytes of `frame` are a valid CRC-16/MODBUS
// over the preceding bytes.
bool verify_rtu_crc(const std::vector<uint8_t>& frame);

// --- Modbus TCP (MBAP header, function code 0x03 Read Holding Registers) ---
struct MbapHeader {
  uint16_t transaction_id;
  uint16_t protocol_id;  // must be 0 for Modbus
  uint16_t length;       // byte count of unit_id + function_code + payload
  uint8_t unit_id;
};

struct ModbusTcpFrame {
  MbapHeader header;
  uint8_t function_code;
  std::vector<uint8_t> payload;  // for 0x03 response: byte-count + register bytes
};

// Encodes a Read Holding Registers *response* frame (function 0x03) carrying
// `registers` (big-endian per Modbus convention, two bytes each).
std::vector<uint8_t> encode_read_holding_registers_response(
    uint16_t transaction_id, uint8_t unit_id,
    const std::vector<uint16_t>& registers);

// Decodes one complete Modbus TCP frame starting at `data`. Throws
// std::runtime_error on a malformed/truncated frame. Returns the frame and
// the number of bytes consumed, so callers can decode a stream of
// back-to-back frames (as a captured TCP byte stream would contain).
struct DecodedFrame {
  ModbusTcpFrame frame;
  size_t bytes_consumed;
};
DecodedFrame decode_tcp_frame(const uint8_t* data, size_t available);

// Extracts the register values (big-endian uint16 each) from a decoded
// Read Holding Registers response payload.
std::vector<uint16_t> registers_from_response_payload(
    const std::vector<uint8_t>& payload);

}  // namespace periscope::modbus
