# Project Agents & Automation

This document outlines the automated "agents" and scripts that manage this project's data pipeline.

---

## 1. The Build Agent (`scripts/build.js`)

This is the core agent responsible for compiling the raw data from the spreadsheet into a Foundry VTT-compatible compendium.

-   **Source:** Reads from `1st Powers Input.csv`.
-   **Output:** Generates the `packs/powers.db` database file.
-   **Function:**
    -   Translates English terms (e.g., "standard," "close") into the French system-required keys (e.g., "simple," "contact").
    -   Constructs the full HTML description for each item.
    -   Calculates the final point cost.

### How to Use:

To run the build agent, execute the following command in your terminal:

```bash
npm run build
```

---

## 2. The Extraction Agent (`scripts/extract.js`)

This agent is a specialized tool for pulling raw text data directly from the M&M 3e PDF source. Its purpose is to perform the initial "heavy-lifting" of data entry.

-   **Source:** Reads from `MnM_Powers_Only.pdf`.
-   **Output:** Appends new rows to the `1st Powers Input.csv` spreadsheet.
-   **Function:**
    -   Parses the PDF to extract a readable text layer.
    -   Identifies specific powers by name.
    -   Performs a "best-effort" extraction of the power's description, cost, and stats.

### How to Use:

To run the extraction agent, execute the following command:

```bash
node scripts/extract.js
```

**Note:** This agent is designed to be run by the project architect (Gemini). The output often requires manual cleanup and verification in the CSV file before running the final build.

---

---

## 3. Release & Versioning Process

**CRITICAL:** Before pushing any changes to GitHub, the ersion field in the module.json file **MUST** be incremented.

Foundry VTT and The Forge detect updates by comparing the version number in the manifest file. If the version number is not changed, the platform will not recognize that a new update is available.

-   **Patch Release (e.g., 0.1.0 -> 0.1.1):** For minor bug fixes or data corrections.
-   **Minor Release (e.g., 0.1.x -> 0.2.0):** For new features, like adding structured flaws.
-   **Major Release (e.g., 0.x.x -> 1.0.0):** For major, breaking changes.

This step must be performed before the final git commit and git push.
