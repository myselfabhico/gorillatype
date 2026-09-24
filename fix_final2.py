with open('src/App.tsx', 'r') as f:
    c = f.read()
# Restore timer state
if 'const [goalElapsedSec' not in c:
    c = c.replace('const [isDailyGoalOpen', 'const [goalElapsedSec, setGoalElapsedSec] = useState(0);\n  const [isDailyGoalOpen')
# Remove DailyGoal import if still present
c = c.replace("import { DailyGoal } from './components/DailyGoal';\n", '')
with open('src/App.tsx', 'w') as f:
    f.write(c)
