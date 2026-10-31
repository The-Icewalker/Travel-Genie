# -*- coding: utf-8 -*-
import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

def create_gantt_docx(output_path):
    doc = docx.Document()

    # Set Margins (Standard clean 0.6 inch margins for table width)
    for section in doc.sections:
        section.top_margin = Inches(0.6)
        section.bottom_margin = Inches(0.6)
        section.left_margin = Inches(0.6)
        section.right_margin = Inches(0.6)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)

    def set_cell_background(cell, fill_hex):
        shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
        cell._tc.get_or_add_tcPr().append(shading)

    def set_cell_margins(cell, top=100, bottom=100, left=120, right=120):
        tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
        cell._tc.get_or_add_tcPr().append(tcMar)

    def set_table_borders(table, color="CBD5E1", sz="4"):
        borders = parse_xml(
            f'<w:tblBorders {nsdecls("w")}>'
            f'<w:top w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
            f'<w:bottom w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
            f'<w:left w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
            f'<w:right w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
            f'<w:insideH w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
            f'<w:insideV w:val="single" w:sz="{sz}" w:space="0" w:color="{color}"/>'
            f'</w:tblBorders>'
        )
        table._tbl.tblPr.append(borders)

    def prevent_row_split(table):
        for row in table.rows:
            trPr = row._tr.get_or_add_trPr()
            trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))

    # ---------------------------------------------------------
    # Header: Academic Details
    # ---------------------------------------------------------
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_after = Pt(2)

    r_inst = p_inst.add_run("VELLORE INSTITUTE OF TECHNOLOGY (VIT), VELLORE\n")
    r_inst.bold = True
    r_inst.font.size = Pt(13)
    r_inst.font.color.rgb = RGBColor(30, 58, 138) # Deep Navy

    r_school = p_inst.add_run("School of Computer Science and Engineering (SCOPE)\n")
    r_school.bold = True
    r_school.font.size = Pt(10.5)
    r_school.font.color.rgb = RGBColor(71, 85, 105)

    r_course = p_inst.add_run("Course: BCSE307L — Database Systems | Fall Semester 2026–2027\nFaculty: Dr. Deepika J | Slot: L11+L12 / L43+L44 | Class Numbers: VL2026270104071 & VL2026270104074")
    r_course.font.size = Pt(9.0)
    r_course.font.color.rgb = RGBColor(100, 116, 139)

    # ---------------------------------------------------------
    # Document Title
    # ---------------------------------------------------------
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(8)

    r_title = p_title.add_run("PROJECT TIMELINE & SIMPLE GANTT CHART\n")
    r_title.bold = True
    r_title.font.size = Pt(15)
    r_title.font.color.rgb = RGBColor(15, 23, 42)

    r_sub = p_title.add_run("TravelGenie AI — Autonomous Travel Planning & Real-Time Expense Management Platform")
    r_sub.bold = True
    r_sub.font.size = Pt(10.5)
    r_sub.font.color.rgb = RGBColor(37, 99, 235)

    # Context Paragraph
    p_desc = doc.add_paragraph()
    p_desc.paragraph_format.space_after = Pt(10)
    r_desc = p_desc.add_run(
        "In accordance with Project Requirement 2 (Project Planning) of the BCSE307L Course Project Specification, "
        "the table below details the project timeline, work breakdown structure (WBS), and tabular Gantt chart mapping all phases across the 9-week development lifecycle."
    )
    r_desc.font.size = Pt(9.5)

    # ---------------------------------------------------------
    # Section 1: Detailed Milestone Breakdown Table
    # ---------------------------------------------------------
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(10)
    h1.paragraph_format.space_after = Pt(4)
    r_h1 = h1.add_run("1. Project Milestone & Work Breakdown Structure")
    r_h1.bold = True
    r_h1.font.size = Pt(12)
    r_h1.font.color.rgb = RGBColor(30, 58, 138)

    table1_data = [
        ("Phase", "Milestone / Deliverable Description", "Assigned Lead", "Start Date", "End Date", "Days", "Status"),
        ("Phase 1:\nPlanning & Design", "Problem Identification & Domain Research\nRequirements & Functional Scope Definition", "Full-Stack Database Lead", "2026-09-01", "2026-09-07", "7", "Completed"),
        ("Phase 1:\nPlanning & Design", "Entity-Relationship (ER) Modeling (10 Entities)\nRelational Schema & 3NF Normalization Proof", "Full-Stack Database Lead", "2026-09-08", "2026-09-15", "8", "Completed"),
        ("Phase 2:\nDatabase Implementation", "PostgreSQL 16 Schema Setup, DDL Generation\nPKs, FKs, Check Constraints & B-Tree Indexes", "Full-Stack Database Lead", "2026-09-16", "2026-09-22", "7", "Completed"),
        ("Phase 2:\nDatabase Implementation", "Advanced PL/pgSQL: Trigger `trg_expense_after_insert`\nStored Procedure `sp_trip_budget_report`, View `v_trip_cost_summary`", "Full-Stack Database Lead", "2026-09-23", "2026-09-30", "8", "Completed"),
        ("Phase 3:\nBackend Development", "Django REST Framework 3.15 Setup & Models\nAtomic Transactions (`@transaction.atomic`) & CRUD APIs", "Full-Stack Database Lead", "2026-10-01", "2026-10-07", "7", "Completed"),
        ("Phase 3:\nBackend Development", "Single Users Table Architecture (`accounts_user` + Role FK)\nJWT Stateless Auth (SimpleJWT) & Argon2id Hashing", "Full-Stack Database Lead", "2026-10-08", "2026-10-14", "7", "Completed"),
        ("Phase 3:\nBackend Development", "Tri-Engine AI Cascading Engine\nOllama SLM (`qwen-local`) + Google Gemini 1.5 Flash API", "Full-Stack Database Lead", "2026-10-15", "2026-10-18", "4", "Completed"),
        ("Phase 4:\nFrontend & Mobile", "React 18 SPA + Vite Setup, Tailwind CSS 3\nInteractive Leaflet Maps, Weather Widget & Bookings Hub", "Frontend & UI/UX Engineer", "2026-10-19", "2026-10-23", "5", "Completed"),
        ("Phase 4:\nFrontend & Mobile", "React Native / Expo Companion Mobile App for Android\nSmooth Animations & Mobile Expense Tracker", "Frontend & UI/UX Engineer", "2026-10-24", "2026-10-26", "3", "Completed"),
        ("Phase 5:\nCI/CD & Deployment", "GitHub Actions CI/CD Pipeline (`.github/workflows/ci.yml`)\nAutomated Django Auth Tests (`accounts/tests.py`)", "QA & Cloud DevOps Lead", "2026-10-27", "2026-10-28", "2", "Completed"),
        ("Phase 5:\nCI/CD & Deployment", "Cloud Deployment: Vercel CDN + Render Cloud Database\nDatabase Backup Artifacts (`pg_dump`, `datadump.json`)", "QA & Cloud DevOps Lead", "2026-10-28", "2026-10-29", "2", "Completed"),
    ]

    t1 = doc.add_table(rows=len(table1_data), cols=7)
    t1.alignment = WD_TABLE_ALIGNMENT.CENTER
    t1.autofit = False
    set_table_borders(t1, color="CBD5E1", sz="4")
    prevent_row_split(t1)

    col_widths1 = [Inches(1.2), Inches(2.4), Inches(1.3), Inches(0.75), Inches(0.75), Inches(0.4), Inches(0.7)]

    for row_idx, row_data in enumerate(table1_data):
        row = t1.rows[row_idx]
        is_header = (row_idx == 0)
        bg_color = "1E3A8A" if is_header else ("F8FAFC" if row_idx % 2 == 1 else "FFFFFF")

        for col_idx, cell_value in enumerate(row_data):
            cell = row.cells[col_idx]
            cell.width = col_widths1[col_idx]
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=70, bottom=70, left=90, right=90)
            cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

            p = cell.paragraphs[0]
            p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx in [0, 3, 4, 5, 6] else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.05

            run = p.add_run(cell_value)
            run.font.size = Pt(8.5)
            if is_header:
                run.bold = True
                run.font.color.rgb = RGBColor(255, 255, 255)
            elif col_idx == 6:
                run.bold = True
                run.font.color.rgb = RGBColor(16, 149, 193)
            elif col_idx == 0:
                run.bold = True
                run.font.color.rgb = RGBColor(30, 58, 138)
            else:
                run.font.color.rgb = RGBColor(30, 41, 59)

    # ---------------------------------------------------------
    # Section 2: Visual Simple Gantt Chart Matrix
    # ---------------------------------------------------------
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(18)
    h2.paragraph_format.space_after = Pt(4)
    r_h2 = h2.add_run("2. Simple Gantt Chart Matrix (Weekly Timeline)")
    r_h2.bold = True
    r_h2.font.size = Pt(12)
    r_h2.font.color.rgb = RGBColor(30, 58, 138)

    # Visual Legend
    p_legend = doc.add_paragraph()
    p_legend.paragraph_format.space_after = Pt(8)
    r_leg_title = p_legend.add_run("Legend:  ")
    r_leg_title.bold = True
    r_leg_title.font.size = Pt(9.0)

    r_leg_box1 = p_legend.add_run("[ Solid Blue Cell ]")
    r_leg_box1.bold = True
    r_leg_box1.font.size = Pt(9.0)
    r_leg_box1.font.color.rgb = RGBColor(37, 99, 235) # Royal Blue

    r_leg_lbl1 = p_legend.add_run(" = Active Execution & Milestone Delivery   |   ")
    r_leg_lbl1.font.size = Pt(9.0)

    r_leg_box2 = p_legend.add_run("[ Plain Cell ]")
    r_leg_box2.bold = True
    r_leg_box2.font.size = Pt(9.0)
    r_leg_box2.font.color.rgb = RGBColor(148, 163, 184)

    r_leg_lbl2 = p_legend.add_run(" = Inactive Period")
    r_leg_lbl2.font.size = Pt(9.0)

    # Gantt Chart Matrix Definition (11 Tasks x 9 Weeks)
    gantt_schedule = [
        ("1. Problem Identification & Scope",        [1, 0, 0, 0, 0, 0, 0, 0, 0]),
        ("2. ER Modeling & 3NF Normalization",       [0, 1, 0, 0, 0, 0, 0, 0, 0]),
        ("3. PostgreSQL Schema, DDL & Constraints",  [0, 0, 1, 0, 0, 0, 0, 0, 0]),
        ("4. PL/pgSQL Triggers, Procedures & Views", [0, 0, 0, 1, 0, 0, 0, 0, 0]),
        ("5. Django REST Framework & CRUD Setup",    [0, 0, 0, 0, 1, 0, 0, 0, 0]),
        ("6. Single Users Table, JWT Auth & RBAC",   [0, 0, 0, 0, 0, 1, 0, 0, 0]),
        ("7. Tri-Engine AI Engine (Ollama + Gemini)",[0, 0, 0, 0, 0, 0, 1, 0, 0]),
        ("8. React 18 SPA, Maps & Weather Hub",      [0, 0, 0, 0, 0, 0, 1, 1, 0]),
        ("9. React Native Android Companion App",    [0, 0, 0, 0, 0, 0, 0, 1, 0]),
        ("10. CI/CD GitHub Actions & Unit Tests",    [0, 0, 0, 0, 0, 0, 0, 1, 1]),
        ("11. Cloud Deployments & Evaluation Review",[0, 0, 0, 0, 0, 0, 0, 0, 1]),
    ]

    week_headers = [
        "Task / Activity Description",
        "W1\n(Sep 1-7)",
        "W2\n(Sep 8-15)",
        "W3\n(Sep 16-22)",
        "W4\n(Sep 23-30)",
        "W5\n(Oct 1-7)",
        "W6\n(Oct 8-14)",
        "W7\n(Oct 15-21)",
        "W8\n(Oct 22-28)",
        "W9\n(Oct 29-31)",
    ]

    t2 = doc.add_table(rows=len(gantt_schedule) + 1, cols=10)
    t2.alignment = WD_TABLE_ALIGNMENT.CENTER
    t2.autofit = False
    set_table_borders(t2, color="94A3B8", sz="6") # Crisp slate border
    prevent_row_split(t2)

    col_widths2 = [Inches(2.5)] + [Inches(0.53)] * 9

    # Render Header Row
    header_row = t2.rows[0]
    for col_idx, text in enumerate(week_headers):
        cell = header_row.cells[col_idx]
        cell.width = col_widths2[col_idx]
        set_cell_background(cell, "1E3A8A") # Navy Blue
        set_cell_margins(cell, top=70, bottom=70, left=50, right=50)
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER if col_idx > 0 else WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)

        run = p.add_run(text)
        run.bold = True
        run.font.size = Pt(8.0)
        run.font.color.rgb = RGBColor(255, 255, 255)

    # Render Data Rows
    for row_idx, (task_name, weeks) in enumerate(gantt_schedule, start=1):
        row = t2.rows[row_idx]
        alt_bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"

        # Column 0: Task Title
        cell_task = row.cells[0]
        cell_task.width = col_widths2[0]
        set_cell_background(cell_task, alt_bg)
        set_cell_margins(cell_task, top=60, bottom=60, left=80, right=60)
        cell_task.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

        p_task = cell_task.paragraphs[0]
        p_task.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_task.paragraph_format.space_before = Pt(0)
        p_task.paragraph_format.space_after = Pt(0)
        run_task = p_task.add_run(task_name)
        run_task.bold = True
        run_task.font.size = Pt(8.5)
        run_task.font.color.rgb = RGBColor(30, 41, 59)

        # Columns 1 to 9: Gantt Bars
        for w_idx, is_active in enumerate(weeks, start=1):
            cell_w = row.cells[w_idx]
            cell_w.width = col_widths2[w_idx]
            cell_w.vertical_alignment = WD_ALIGN_VERTICAL.CENTER

            p_cell = cell_w.paragraphs[0]
            p_cell.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_cell.paragraph_format.space_before = Pt(0)
            p_cell.paragraph_format.space_after = Pt(0)

            if is_active == 1:
                # PURE SOLID COLOR BAR - NO GLITCHY UNICODE / FONT CHARACTERS!
                set_cell_background(cell_w, "2563EB") # Rich Royal Blue fill
                set_cell_margins(cell_w, top=80, bottom=80, left=0, right=0)
                r = p_cell.add_run("") # Clean solid cell fill
                r.font.size = Pt(8.0)
            else:
                set_cell_background(cell_w, alt_bg)
                set_cell_margins(cell_w, top=80, bottom=80, left=0, right=0)
                r = p_cell.add_run("")
                r.font.size = Pt(8.0)

    # ---------------------------------------------------------
    # Section 3: Team Responsibilities & Academic Compliance
    # ---------------------------------------------------------
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(16)
    h3.paragraph_format.space_after = Pt(4)
    r_h3 = h3.add_run("3. Team Roles & Academic Verification")
    r_h3.bold = True
    r_h3.font.size = Pt(12)
    r_h3.font.color.rgb = RGBColor(30, 58, 138)

    p_summary = doc.add_paragraph()
    p_summary.paragraph_format.space_after = Pt(6)
    r_sum = p_summary.add_run(
        "• Full-Stack Database Lead (Bassil & Team): Architected the 10-table 3NF relational database schema; implemented PostgreSQL triggers (`trg_expense_after_insert`), stored procedures (`sp_trip_budget_report`), and views (`v_trip_cost_summary`). Engineered Django REST Framework backend with strict Single Users Table RBAC, SimpleJWT stateless auth, and Tri-Engine AI cascading (Ollama + Google Gemini).\n"
        "• Frontend & UI/UX Engineer: Designed and developed the React 18 Single-Page Application (SPA) with Tailwind CSS, Leaflet OpenStreetMap coordinate routing, live Open-Meteo forecasts, and the companion React Native / Expo mobile application for Android.\n"
        "• QA & Cloud DevOps Lead: Implemented automated unit test suites in Django (`accounts/tests.py`), orchestrated the GitHub Actions CI/CD automation pipeline (`ci.yml`), configured Docker containerization, and deployed live services on Vercel CDN and Render PostgreSQL."
    )
    r_sum.font.size = Pt(9.0)

    # Footer note
    p_foot = doc.add_paragraph()
    p_foot.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p_foot.paragraph_format.space_before = Pt(14)
    r_foot = p_foot.add_run("Document Version: 2.0 (Clean Gantt Rendering) | Repository: https://github.com/The-Icewalker/Travel-Genie")
    r_foot.font.italic = True
    r_foot.font.size = Pt(8.0)
    r_foot.font.color.rgb = RGBColor(148, 163, 184)

    doc.save(output_path)
    print(f"Successfully generated clean DOCX at: {output_path}")

if __name__ == "__main__":
    out_file1 = r"C:\Users\Bassil\.gemini\antigravity\scratch\travelgenie-ai\TravelGenie_Project_Timeline_Gantt_Chart_v2.docx"
    create_gantt_docx(out_file1)
    out_file2 = r"C:\Users\Bassil\.gemini\antigravity\scratch\travelgenie-ai\TravelGenie_Gantt_Chart.docx"
    create_gantt_docx(out_file2)
    # Also attempt writing to original in case Word was closed
    try:
        out_file_orig = r"C:\Users\Bassil\.gemini\antigravity\scratch\travelgenie-ai\TravelGenie_Project_Timeline_Gantt_Chart.docx"
        create_gantt_docx(out_file_orig)
    except PermissionError:
        print("Note: Original file is currently open in Microsoft Word. Saved to v2 and Gantt_Chart files.")
