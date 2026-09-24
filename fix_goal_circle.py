with open('src/App.tsx', 'r') as f:
    c = f.read()
# Find start of goal ring div
start = c.find('<div class="fixed right-8 top-[84px]')
# Find the closing of the condition block after inner div (look for the closing )</div> after start)
end = c.find('</div>\n      {showGoalComplete', start)
if end == -1:
    end = c.find('      </div>\n      {showGoalComplete', start)
new_block = '      <div class="fixed right-8 top-[84px] z-40 w-24 h-24 bg-[#1a1a1a]/90 border border-[#383838] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(168,230,211,0.4)] backdrop-blur-md" aria-label="Daily Goal">\n        <div class="text-xl font-mono font-black text-[#a8e6d3] tracking-tight drop-shadow">{`${String(Math.floor(Math.max(0, (getGoal().minutes * 60 - getGoal().dayActiveTime) / 60)))}:${String(Math.round(Math.max(0, getGoal().minutes * 60 - getGoal().dayActiveTime) % 60)).padStart(2,"0")}/${getGoal().minutes}m`}</div>\n      </div>\n'
c = c[:start] + new_block + c[end+10:]  # approximate close
with open('src/App.tsx', 'w') as f:
    f.write(c)
