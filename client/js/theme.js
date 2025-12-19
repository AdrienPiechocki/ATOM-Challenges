fetch('/palette')
  .then(res => res.json())
  .then(palette => {
    for (const key in palette) {
      document.documentElement.style.setProperty(`--${key}`, palette[key]);
    }
  });
