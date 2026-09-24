// fix_app.py
with open('src/App.tsx', 'r') as f:
    c = f.read()
if "import { DailyGoal } from './components/DailyGoal';" not in c:
    c = c.replace("import { HangoutMode } from './components/HangoutMode';", "import { DailyGoal } from './components/DailyGoal';\nimport { HangoutMode } from './components/HangoutMode';")
with open('src/App.tsx', 'w') as f:
    f.write(c)
