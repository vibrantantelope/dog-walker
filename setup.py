#!/usr/bin/env python3
"""
Script to scaffold Dog Walk Tracker PWA file structure.
Usage: python create_structure.py [project_directory]
"""

import os
import argparse


def main():
    parser = argparse.ArgumentParser(
        description="Scaffold Dog Walk Tracker PWA structure."
    )
    parser.add_argument(
        "project_dir",
        nargs="?",
        default="dog-walk-tracker",
        help="Root directory name for the project."
    )
    args = parser.parse_args()

    # Create root directory
    project_dir = args.project_dir
    os.makedirs(project_dir, exist_ok=True)

    # Files to create
    files = [
        "index.html",
        "style.css",
        "app.js",
        "manifest.json",
        "service-worker.js",
        "paw-icon.png",
        "paw-icon-512.png",
        "README.md",
    ]

    # Create each file if it doesn't exist
    for filename in files:
        filepath = os.path.join(project_dir, filename)
        if not os.path.exists(filepath):
            # Create empty placeholder file
            open(filepath, 'a').close()
            print(f"Created {filepath}")
        else:
            print(f"{filepath} already exists, skipping")

    print(f"\nProject scaffolded at: {os.path.abspath(project_dir)}")


if __name__ == "__main__":
    main()
