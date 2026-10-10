#!/usr/bin/env python3
"""Validate the static exam dataset and every referenced question image."""

import argparse
import json
import math
import re
from datetime import date
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
EXPECTED_ROUNDS = {str(round_id) for round_id in range(70, 80)}
REGION_TOLERANCE = 0.000001
# Public history institutions whose domains do not use government/academic suffixes.
PRIMARY_SOURCE_DOMAINS = {
    "i815.or.kr", "kdemo.or.kr", "itkc.or.kr", "koreanhistory.or.kr", "nahf.or.kr",
    "britishmuseum.org", "metmuseum.org", "si.edu",
    "korea.kr",  # Official Korean government Policy Briefing portal.
}


def primary_source_url(url):
    if not isinstance(url, str):
        return False
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower().rstrip(".")
    except ValueError:
        return False
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        return False
    public_suffix = re.search(r"\.(?:go\.kr|ac\.kr|mil\.kr|gov|edu|gov\.[a-z]{2}|edu\.[a-z]{2})$", host)
    institution = any(host == domain or host.endswith("." + domain)
                      for domain in PRIMARY_SOURCE_DOMAINS)
    return bool(public_suffix or institution)


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
    check(len(exams) == 10, f"Expected 10 exams, found {len(exams)}.")
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
                  all(isinstance(option, str) and bool(option.strip()) for option in options),
                  f"{qlabel}: options must contain five nonempty transcriptions or image descriptions.")
            if isinstance(options, list):
                for index, option in enumerate(options, 1):
                    generic = isinstance(option, str) and re.fullmatch(
                        r"(?:[①②③④⑤1-5]\s*(?:번)?\s*(?:보기|선택지|답안)|(?:보기|선택지|답안)\s*[①②③④⑤1-5])",
                        option.strip())
                    check(not generic, f"{qlabel}, choice {index}: replace the generic label with actual choice content.")
            regions = question.get("choiceRegions")
            check(isinstance(regions, list) and len(regions) == 5,
                  f"{qlabel}: choiceRegions must contain five original-choice rectangles.")
            if isinstance(regions, list):
                for index, region in enumerate(regions, 1):
                    values = [region.get(key) for key in ("x", "y", "w", "h")] if isinstance(region, dict) else []
                    finite = len(values) == 4 and all(type(value) in (int, float) and math.isfinite(value)
                                                    for value in values)
                    if not finite:
                        errors.append(f"{qlabel}, choice {index}: region coordinates must be finite numbers.")
                        continue
                    x, y, width, height = values
                    check(all(0 <= value <= 1 for value in values) and width > 0 and height > 0 and
                          x + width <= 1 + REGION_TOLERANCE and y + height <= 1 + REGION_TOLERANCE,
                          f"{qlabel}, choice {index}: region must have positive area within normalized image bounds.")
            explanations = question.get("explanations")
            check(isinstance(explanations, list) and len(explanations) == 5 and
                  all(isinstance(item, str) and len(item.strip()) >= 20 for item in explanations),
                  f"{qlabel}: explanations must contain five substantive strings of at least 20 characters.")
            short_explanations = question.get("shortExplanations")
            check(isinstance(short_explanations, list) and len(short_explanations) == 5 and
                  all(isinstance(item, str) and len(item.strip()) >= 4 and len(item) <= 26 and
                      not re.search(r"[\r\n\v\f\x85\u2028\u2029]", item) for item in short_explanations),
                  f"{qlabel}: shortExplanations must contain five single-line strings of 4–26 characters.")
            key_explanation = question.get("keyExplanation")
            check(isinstance(key_explanation, str) and bool(key_explanation.strip()),
                  f"{qlabel}: keyExplanation must be a nonempty string.")
            short_key = question.get("shortKeyExplanation")
            check(isinstance(short_key, str) and 4 <= len(short_key.strip()) <= 50 and
                  not re.search(r"[\r\n\v\f\x85\u2028\u2029]", short_key),
                  f"{qlabel}: shortKeyExplanation must be a single line of 4–50 characters.")
            explanation_sources = question.get("explanationSources")
            check(isinstance(explanation_sources, list) and len(explanation_sources) >= 1,
                  f"{qlabel}: explanationSources must contain at least one primary source.")
            if isinstance(explanation_sources, list):
                for index, explanation_source in enumerate(explanation_sources, 1):
                    valid = isinstance(explanation_source, dict)
                    title = explanation_source.get("title") if valid else None
                    url = explanation_source.get("url") if valid else None
                    check(isinstance(title, str) and bool(title.strip()) and primary_source_url(url),
                          f"{qlabel}, explanation source {index}: a title and reliable primary HTTPS URL are required.")
            image = question.get("image")
            for dimension in ("imageWidth", "imageHeight"):
                value = question.get(dimension)
                check(type(value) is int and value > 0,
                      f"{qlabel}: {dimension} must be a positive integer.")
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
    check(set(rounds) == EXPECTED_ROUNDS, "Expected all ten rounds from 70 through 79.")
    check(total_questions == 500, f"Expected 500 questions, found {total_questions}.")
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
    print("Validated 10 exams / 500 questions and images / 2,500 choice regions, short notes and source-backed explanations / 100 points per exam.")


if __name__ == "__main__":
    main()
