import re

with open("concert-presale-watcher/apps/web/app/dashboard/dashboard.module.css", "r") as f:
    css = f.read()

replacements = {
    r'var\(--text-xs\)': '11px',
    r'var\(--text-sm\)': '13px',
    r'var\(--text-base\)': '14px',
    r'var\(--text-lg\)': '16px',
    r'var\(--text-xl\)': '22px',
    r'var\(--text-2xl\)': '28px',
    
    r'var\(--r-xs\)': '6px',
    r'var\(--r-sm\)': '10px',
    r'var\(--r-md\)': '18px',  # Updated to 18px based on the prompt for medium elements
    r'var\(--r-lg\)': '22px',
    r'var\(--r-xl\)': '22px',
    r'var\(--r-full\)': '999px',
    
    r'var\(--ink\)': '#fff',
    r'var\(--ink-2\)': 'rgba(255, 255, 255, 0.7)',
    r'var\(--muted\)': 'rgba(255, 255, 255, 0.5)',
    r'var\(--subtle\)': 'rgba(255, 255, 255, 0.42)',
    
    r'var\(--edge\)': 'rgba(255, 255, 255, 0.12)',
    r'var\(--edge-soft\)': 'rgba(255, 255, 255, 0.08)',
    r'var\(--edge-strong\)': 'rgba(255, 255, 255, 0.18)',
    
    r'var\(--bg-raised\)': 'rgba(255, 255, 255, 0.03)',
    r'var\(--bg-deep\)': 'rgba(0, 0, 0, 0.32)',
    r'var\(--panel\)': 'rgba(255, 255, 255, 0.055)',
    
    r'var\(--accent\)': '#fff',
    r'var\(--accent-warm\)': '#fff',
    r'var\(--danger\)': 'rgba(255, 109, 109, 0.92)',
    r'var\(--danger-soft\)': 'rgba(255, 109, 109, 0.1)',
    r'var\(--success\)': 'rgba(111, 214, 149, 0.88)',
    r'var\(--success-soft\)': 'rgba(111, 214, 149, 0.1)',
    r'var\(--warning\)': 'rgba(244, 196, 122, 0.92)',
    r'var\(--warning-soft\)': 'rgba(244, 196, 122, 0.1)',
}

for pattern, repl in replacements.items():
    css = re.sub(pattern, repl, css)

with open("concert-presale-watcher/apps/web/app/dashboard/dashboard.module.css", "w") as f:
    f.write(css)

print("Cleanup done.")
