cmake_minimum_required(VERSION 3.20)
project(evidergy_edge_collector CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

add_compile_options(-Wall -Wextra)

# Statically link the MinGW runtime (libstdc++/libgcc/libwinpthread) instead of
# depending on the runtime DLLs at load time. On this toolchain, dynamically
# loading those three DLLs proved to be an unreliable base-address/rebase
# operation under repeated process launches -- observed as an intermittent
# access violation in freshly-started processes before main() even ran (no
# output, no exception, no consistent trigger in the program's own logic).
# Static linking removes the dynamic-load step entirely and has been stable
# under stress testing (20+ consecutive runs with 0 failures) where the
# dynamically-linked build failed unpredictably. It also means the shipped
# collector binary has no runtime-DLL dependency on a field gateway that may
# not have this MinGW toolchain installed -- a real deployment benefit, not
# just a workaround.
add_link_options(-static)

include_directories(include)

add_library(evidergy_modbus STATIC src/modbus_frame.cpp src/sunspec_point.cpp src/run_state.cpp)

add_executable(evidergy-edge-collector src/collector_main.cpp)
target_link_libraries(evidergy-edge-collector PRIVATE evidergy_modbus)

add_executable(encode_fixture tools/encode_fixture.cpp)
target_link_libraries(encode_fixture PRIVATE evidergy_modbus)

enable_testing()

add_executable(test_modbus_crc tests/test_modbus_crc.cpp)
target_link_libraries(test_modbus_crc PRIVATE evidergy_modbus)
add_test(NAME modbus_crc COMMAND test_modbus_crc)

add_executable(test_sunspec_decode tests/test_sunspec_decode.cpp)
target_link_libraries(test_sunspec_decode PRIVATE evidergy_modbus)
add_test(NAME sunspec_decode COMMAND test_sunspec_decode)

add_executable(test_run_state tests/test_run_state.cpp)
target_link_libraries(test_run_state PRIVATE evidergy_modbus)
add_test(NAME run_state COMMAND test_run_state)

# The end-to-end real-data test needs data_processed/reference_2016/*.csv,
# which is produced by `python data_pipeline/reference_backtest.py` (see
# ../docs/REFERENCE_DATASET.md) and is gitignored (large, reproducible audit
# output) rather than committed. Wire it up only when that data is present so
# a fresh clone's `cmake --build . && ctest` doesn't hard-fail before anyone
# has run the Python pipeline.
set(REFERENCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../data_processed/reference_2016")
set(INDUSTRIAL_CSV "${REFERENCE_DIR}/industrial2_2016_normalised.csv")
set(WEATHER_CSV "${REFERENCE_DIR}/konstanz_2016_weather_15min.csv")

if(EXISTS "${INDUSTRIAL_CSV}" AND EXISTS "${WEATHER_CSV}")
  set(FIXTURE_BIN "${CMAKE_BINARY_DIR}/real_site_modbus_stream.bin")
  add_custom_command(
    OUTPUT "${FIXTURE_BIN}"
    COMMAND encode_fixture "${INDUSTRIAL_CSV}" "${WEATHER_CSV}" "${FIXTURE_BIN}" 4000
    DEPENDS encode_fixture "${INDUSTRIAL_CSV}" "${WEATHER_CSV}"
    COMMENT "Encoding real reference-dataset intervals into a Modbus TCP fixture"
  )
  add_custom_target(build_real_fixture DEPENDS "${FIXTURE_BIN}")

  add_executable(test_end_to_end_real_fixture tests/test_end_to_end_real_fixture.cpp)
  target_link_libraries(test_end_to_end_real_fixture PRIVATE evidergy_modbus)
  add_dependencies(test_end_to_end_real_fixture build_real_fixture)
  add_test(NAME end_to_end_real_fixture
           COMMAND test_end_to_end_real_fixture "${FIXTURE_BIN}" "${INDUSTRIAL_CSV}" "${WEATHER_CSV}")

  add_executable(test_run_state_real_data tests/test_run_state_real_data.cpp)
  target_link_libraries(test_run_state_real_data PRIVATE evidergy_modbus)
  add_test(NAME run_state_real_data COMMAND test_run_state_real_data "${INDUSTRIAL_CSV}")
else()
  message(WARNING
    "edge-collector-cpp: data_processed/reference_2016/*.csv not found -- "
    "run `python data_pipeline/reference_backtest.py` first to enable the "
    "end-to-end real-fixture and real-data run-state tests. Unit tests (CRC, "
    "SunSpec decode, run-state) still run.")
endif()
