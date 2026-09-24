with open('src/App.tsx','r') as f: c=f.read()
# Add computed vars right before return
old = '\n  return (\n    <div className="min-h-screen'
new = '\n  const goalRemainingSec = Math.max(0, Math.round((getGoal().minutes * 60) - getGoal().dayActiveTime));\n  return (\n    <div className="min-h-screen'
c = c.replace(old, new)
# Replace circle inner text to use goalRemainingSec directly (simpler expression)
c = c.replace('>{`${String(Math.floor(Math.max(0, getGoal().minutes * 60 - getGoal().dayActiveTime) / 60))}:${String(Math.round(Math.max(0, getGoal().minutes * 60 - getGoal().dayActiveTime) % 60)).padStart(2, \'0\')}`}</div>', ">{`${String(Math.floor(goalRemainingSec / 60))}:${String(Math.round(goalRemainingSec % 60)).padStart(2, \'0\')}`}</div>')
# Remove goalElapsedSec state if still there (should have been removed by edit already, but guard)
c = c.replace('  const [goalElapsedSec, setGoalElapsedSec] = useState(0);\n', '')
with open('src/App.tsx','w') as f: f.write(c)
