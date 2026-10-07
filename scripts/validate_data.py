#!/usr/bin/env python3
"""Validate the static exam dataset and every referenced question image."""

import argparse
import json
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ROUNDS = {"75", "76", "77", "78", "79"}


def validate(data_path: Path) -> list[str]:
    errors = []

    def check(condition, message):
        if not condition:
            errors.append(message)

    try:
        exams = json.loads(data_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [f"Cannot read exam data: {exc}"]
    if not isinstance(exams, list):
        return ["Dataset must be an array of exams."]
    check(len(exams) == 5, f"Expected 5 exams, found {len(exams)}.")
    rounds = []
    image_paths = []
    total_questions = 0
    for exam in exams:
        if not isinstance(exam, dict):
            errors.append("Every exam must be an object.")
            continue
        round_id = str(exam.get("id", ""))
        label = f"Round {round_id}"
        rounds.append(round_id)
        check(isinstance(exam.get("title"), str) and bool(exam["title"].strip()),
              f"{label}: title is missing.")
        try:
            date.fromisoformat(exam.get("date", ""))
        except (ValueError, TypeError):
            errors.append(f"{label}: date must be a valid YYYY-MM-DD date.")
        check(exam.get("duration") == 80, f"{label}: duration must be 80 minutes.")
        source = exam.get("source", {})
        if not isinstance(source, dict):
            source = {}
        for kind in ("listing", "paper", "answers"):
            url = source.get(kind, "")
            if not isinstance(url, str):
                url = ""
            parsed = urlparse(url)
            host = (parsed.hostname or "").lower()
            check(parsed.scheme == "https" and
                  (host == "historyexam.go.kr" or host.endswith(".historyexam.go.kr")),
                  f"{label}: {kind} source must be an official HTTPS URL.")
        questions = exam.get("questions", [])
        if not isinstance(questions, list):
            errors.append(f"{label}: questions must be an array.")
            continue
        check(len(questions) == 50, f"{label}: expected 50 questions, found {len(questions)}.")
        total_questions += len(questions)
        numbers = []
        points = 0
        for question in questions:
            if not isinstance(question, dict):
                errors.append(f"{label}: every question must be an object.")
                continue
            number = question.get("number")
            qlabel = f"{label}, question {number}"
            numbers.append(number)
            check(type(number) is int and 1 <= number <= 50,
                  f"{qlabel}: number must be an integer from 1 to 50.")
            answer = question.get("answer")
            check(type(answer) is int and 1 <= answer <= 5,
                  f"{qlabel}: answer must be an integer from 1 to 5.")
            weight = question.get("points")
            if type(weight) is int and 1 <= weight <= 3:
                points += weight
            else:
                errors.append(f"{qlabel}: points must be an integer from 1 to 3.")
            check(isinstance(question.get("text"), str), f"{qlabel}: text must be a string.")
            options = question.get("options")
            check(isinstance(options, list) and len(options) == 5 and
                  all(isinstance(option, str) for option in options),
                  f"{qlabel}: options must contain five strings.")
            image = question.get("image")
            if not isinstance(image, str) or not image:
                errors.append(f"{qlabel}: image path is missing.")
                continue
            image_path = (ROOT / image).resolve()
            image_paths.append(str(image_path))
            if not image_path.is_relative_to(ROOT / "assets"):
                errors.append(f"{qlabel}: image must be inside assets/.")
            elif not image_path.is_file() or image_path.stat().st_size == 0:
                errors.append(f"{qlabel}: image is missing or empty: {image}")
        check(len(numbers) == 50 and all(type(n) is int for n in numbers) and
              sorted(numbers) == list(range(1, 51)),
              f"{label}: question numbers must cover 1–50 exactly once.")
        check(points == 100, f"{label}: weighted total must be 100, found {points}.")
    check(len(rounds) == len(set(rounds)), "Exam IDs must be unique.")
    check(set(rounds) == EXPECTED_ROUNDS, "Expected rounds 79, 78, 77, 76, and 75.")
    check(total_questions == 250, f"Expected 250 questions, found {total_questions}.")
    check(len(image_paths) == len(set(image_paths)), "Every question must have a distinct image.")
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("data", nargs="?", type=Path, default=ROOT / "assets/data/exams.json")
    args = parser.parse_args()
    errors = validate(args.data)
    if errors:
        print("Exam data validation failed:")
        for error in errors:
            print(f"  - {error}")
        raise SystemExit(1)
    print("Validated 5 exams / 250 questions / 250 images / 100 points per exam.")


if __name__ == "__main__":
    main()
