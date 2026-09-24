with open('src/App.tsx', 'r') as f:
    c = f.read()
c = c.replace('  const [goalElapsedSec, setGoalElapsedSec] = useState(0);\n', '')
c = c.replace('  const ringProgress = Math.min(1, goalRemainingSec / Math.max(1, getGoal().minutes * 60));\n', '')
c = c.replace('strokeDasharray={`${2 * Math.PI * 42 * ringProgress} ${2 * Math.PI * 42}`}', 'strokeDasharray={`${2 * Math.PI * 42 * Math.min(1, Math.max(0, goalRemainingSec) / Math.max(1, getGoal().minutes * 60))} ${2 * Math.PI * 42}`}')
with open('src/App.tsx', 'w') as f:
    f.write(c)
