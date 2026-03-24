"""Mock hardware simulator for a 7400 NAND gate device under test."""

from __future__ import annotations

from datetime import datetime, timedelta
from random import Random

from backend.analytics.statistics import enrich_reading, expected_state_from_inputs


class MockDevice:
    """Simulate a 7400-class quad NAND gate with deterministic drift profiles."""

    def __init__(
        self,
        seed: int = 7400,
        batch_profile: int = 0,
        inject_reference_failures: bool = True,
    ) -> None:
        self.seed = seed
        self.batch_profile = batch_profile
        self.inject_reference_failures = inject_reference_failures
        self._random = Random(seed)
        self._reference_failures_seen: set[tuple[int, int, int]] = set()

    def run_tests(
        self,
        test_plan: list[dict],
        cycles: int = 1,
        focus_gate: int | None = None,
        focus_input_a: int | None = None,
        focus_input_b: int | None = None,
        sample_count: int | None = None,
        phase: str = "initial",
        source: str = "simulation",
    ) -> list[dict]:
        """Generate simulated readings for the truth table or a focused condition."""
        _ = test_plan
        readings: list[dict] = []
        base_timestamp = datetime(2024, 1, 1, 10, 0, 0)
        cycle = 0

        while True:
            for gate in range(4):
                for input_a in range(2):
                    for input_b in range(2):
                        if focus_gate is not None and gate != focus_gate:
                            continue
                        if focus_input_a is not None and input_a != focus_input_a:
                            continue
                        if focus_input_b is not None and input_b != focus_input_b:
                            continue

                        index = len(readings)
                        expected_state = expected_state_from_inputs(input_a, input_b)
                        measured_voltage = self._build_voltage(gate, input_a, input_b, expected_state, cycle)
                        passed = self._evaluate_result(expected_state, measured_voltage)
                        reading = enrich_reading(
                            {
                                "test_id": f"TC-{index + 1:03d}",
                                "gate": gate,
                                "input_a": input_a,
                                "input_b": input_b,
                                "measured_voltage": round(measured_voltage, 3),
                                "result": "PASS" if passed else "FAIL",
                                "timestamp": (base_timestamp + timedelta(milliseconds=index * 180)).isoformat(),
                                "supply_voltage": round(5.0 - (self.batch_profile * 0.03), 3),
                            },
                            source=source,
                            phase=phase,
                            batch_id=f"BATCH-{self.batch_profile + 1:02d}" if phase == "batch" else None,
                        )
                        readings.append(reading)
                        if sample_count is not None and len(readings) >= sample_count:
                            return readings
            cycle += 1
            if sample_count is not None and len(readings) >= sample_count:
                return readings
            if focus_gate is None and cycle >= cycles:
                return readings
            if focus_gate is not None and sample_count is None and cycle >= cycles:
                return readings

    def _build_voltage(
        self,
        gate: int,
        input_a: int,
        input_b: int,
        expected_state: str,
        cycle: int,
    ) -> float:
        """Build a deterministic measured voltage for a given gate/input combination."""
        condition = (gate, input_a, input_b)
        if self.inject_reference_failures and self.seed == 7400 and self.batch_profile == 0 and cycle == 0:
            if condition == (2, 1, 1) and condition not in self._reference_failures_seen:
                self._reference_failures_seen.add(condition)
                return 0.62
            if condition == (3, 0, 0) and condition not in self._reference_failures_seen:
                self._reference_failures_seen.add(condition)
                return 2.1

        drift_low = 0.0
        drift_high = 0.0
        if gate == 2:
            drift_low = 0.04 * self.batch_profile
        if gate == 3:
            drift_high = 0.16 * self.batch_profile
        if gate == 1 and self.batch_profile >= 3:
            drift_high += 0.05

        if expected_state == "HIGH":
            base = 4.78 + self._random.uniform(-0.08, 0.08) - drift_high
            if gate == 3 and self.batch_profile >= 2:
                base -= self._random.uniform(0.05, 0.24)
            return max(0.0, base)

        base = 0.12 + self._random.uniform(-0.03, 0.05) + drift_low
        if gate == 2 and self.batch_profile >= 2:
            base += self._random.uniform(0.03, 0.16)
        return max(0.0, base)

    def _evaluate_result(self, expected_state: str, measured_voltage: float) -> bool:
        """Determine whether a measured voltage satisfies the NAND gate specification."""
        if expected_state == "HIGH":
            return measured_voltage > 2.4
        return measured_voltage < 0.4
