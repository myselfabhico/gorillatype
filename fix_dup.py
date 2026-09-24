with open('src/App.tsx','r') as f:
    c = f.read()
first = c.index('const blocked = isModesDrawerOpen')
second = c.index('const blocked = isModesDrawerOpen', first + 1)
if second > 0:
    end = c.index('\n', second) + 1
    c = c[:second] + c[end:]
with open('src/App.tsx','w') as f:
    f.write(c)
