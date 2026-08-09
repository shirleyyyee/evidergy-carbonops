package au.edu.periscope.bms;

/** Tiny assertion helper -- deliberately dependency-free, no JUnit/Maven (see README.md). */
final class TestSupport {
  private TestSupport() {}

  static int failures = 0;

  static void check(boolean condition, String what) {
    if (!condition) {
      System.err.println("FAIL: " + what);
      failures++;
    }
  }

  static void finish(String suiteName) {
    if (failures == 0) {
      System.out.println(suiteName + ": all checks passed");
    } else {
      System.err.println(suiteName + ": " + failures + " check(s) failed");
      System.exit(1);
    }
  }
}
