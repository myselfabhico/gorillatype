with open('src/App.tsx','r') as f: c=f.read()
# Remove duplicate state
c = c.replace('  const [isDailyGoalOpen, setIsDailyGoalOpen] = useState(false);\n  const [showGoalComplete, setShowGoalComplete] = useState(false);\n  const [isDailyGoalOpen, setIsDailyGoalOpen] = useState(false);\n', '  const [isDailyGoalOpen, setIsDailyGoalOpen] = useState(false);\n  const [showGoalComplete, setShowGoalComplete] = useState(false);\n')
# Remove circle JSX block (simplified by removing from start of fixed div to its end)
start = c.find('<div class="fixed right-8 top-[84px]')
if start != -1:
    end = c.find('</div>', start) + len('</div>')
    # Need to find the closing of the condition block; use a safer approach: just delete until next {showGoalComplete}
    end = c.find('{showGoalComplete', start)
    c = c[:start] + c[end:]
# Remove DailyGoal usage in JSX
c = c.replace('      <DailyGoal isOpen={isDailyGoalOpen} onClose={() => setIsDailyGoalOpen(false)} />\n', '')
# Remove import if not needed
with open('src/App.tsx','w') as f: f.write(c)
