#include "modbus_frame.hpp"

namespace evidergy::modbus {

uint16_t crc16_modbus(const uint8_t* data, size_t length) {
  uint16_t crc = 0xFFFF;
  for (size_t i = 0; i < length; ++i) {
    crc ^= static_cast<uint16_t>(data[i]);
    for (int bit = 0; bit < 8; ++bit) {
      if (crc & 0x0001) {
        crc = static_cast<uint16_t>((crc >> 1) ^ 0xA001);
      } else {
        crc = static_cast<uint16_t>(crc >> 1);
      }
    }
  }
  return crc;
}

void append_rtu_crc(std::vector<uint8_t>& frame) {
  uint16_t crc = crc16_modbus(frame.data(), frame.size());
  // Modbus RTU CRC is transmitted low byte first.
  frame.push_back(static_cast<uint8_t>(crc & 0xFF));
  frame.push_back(static_cast<uint8_t>((crc >> 8) & 0xFF));
}

bool verify_rtu_crc(const std::vector<uint8_t>& frame) {
  if (frame.size() < 2) return false;
  // CRC-16/MODBUS has residue 0x0000: running the same CRC over a frame that
  // already ends in its own (little-endian) CRC always yields zero. This is
  // the check real Modbus RTU receivers perform -- no separate recompute
  // needed.
  return crc16_modbus(frame.data(), frame.size()) == 0x0000;
}

std::vector<uint8_t> encode_read_holding_registers_response(
    uint16_t transaction_id, uint8_t unit_id,
    const std::vector<uint16_t>& registers) {
  std::vector<uint8_t> payload;
  payload.push_back(static_cast<uint8_t>(registers.size() * 2));  // byte count
  for (uint16_t reg : registers) {
    payload.push_back(static_cast<uint8_t>((reg >> 8) & 0xFF));  // big-endian
    payload.push_back(static_cast<uint8_t>(reg & 0xFF));
  }

  const uint16_t length = static_cast<uint16_t>(1 /*unit_id*/ + 1 /*function*/ + payload.size());

  std::vector<uint8_t> frame;
  frame.reserve(7 + payload.size());
  frame.push_back(static_cast<uint8_t>((transaction_id >> 8) & 0xFF));
  frame.push_back(static_cast<uint8_t>(transaction_id & 0xFF));
  frame.push_back(0x00);  // protocol id high
  frame.push_back(0x00);  // protocol id low
  frame.push_back(static_cast<uint8_t>((length >> 8) & 0xFF));
  frame.push_back(static_cast<uint8_t>(length & 0xFF));
  frame.push_back(unit_id);
  frame.push_back(0x03);  // function code: Read Holding Registers
  frame.insert(frame.end(), payload.begin(), payload.end());
  return frame;
}

DecodedFrame decode_tcp_frame(const uint8_t* data, size_t available) {
  if (available < 8) {
    throw std::runtime_error("modbus tcp frame shorter than MBAP+function header");
  }
  MbapHeader header{};
  header.transaction_id = static_cast<uint16_t>((data[0] << 8) | data[1]);
  header.protocol_id = static_cast<uint16_t>((data[2] << 8) | data[3]);
  header.length = static_cast<uint16_t>((data[4] << 8) | data[5]);
  header.unit_id = data[6];

  if (header.protocol_id != 0) {
    throw std::runtime_error("unsupported protocol id (not Modbus)");
  }
  if (header.length < 2) {
    throw std::runtime_error("invalid MBAP length field");
  }
  const size_t total_frame_len = 6 + header.length;  // 6 = txn(2)+proto(2)+len(2)
  if (available < total_frame_len) {
    throw std::runtime_error("truncated modbus tcp frame");
  }

  ModbusTcpFrame frame;
  frame.header = header;
  frame.function_code = data[7];
  frame.payload.assign(data + 8, data + total_frame_len);

  return DecodedFrame{frame, total_frame_len};
}

std::vector<uint16_t> registers_from_response_payload(
    const std::vector<uint8_t>& payload) {
  if (payload.empty()) {
    throw std::runtime_error("empty read-holding-registers payload");
  }
  const uint8_t byte_count = payload[0];
  if (payload.size() != static_cast<size_t>(1 + byte_count) || byte_count % 2 != 0) {
    throw std::runtime_error("malformed read-holding-registers byte count");
  }
  std::vector<uint16_t> registers;
  registers.reserve(byte_count / 2);
  for (size_t i = 1; i < payload.size(); i += 2) {
    registers.push_back(static_cast<uint16_t>((payload[i] << 8) | payload[i + 1]));
  }
  return registers;
}

}  // namespace evidergy::modbus
