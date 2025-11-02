document.addEventListener('DOMContentLoaded', () => {
  const animatedPaths = document.querySelectorAll('.path');

  animatedPaths.forEach((path) => {
    const length = path.getTotalLength();
    path.style.setProperty('--path-length', length);
    path.style.strokeDasharray = length;
    path.style.strokeDashoffset = length;
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    animatedPaths.forEach((path) => {
      path.style.animation = 'none';
      path.style.opacity = 1;
      path.style.strokeDashoffset = 0;
    });

    document.querySelectorAll('.charger-port, .charger-port__center').forEach((el) => {
      el.style.animation = 'none';
      el.style.opacity = 1;
    });
    return;
  }

  const carScene = document.getElementById('carScene');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          carScene.classList.add('animate');
        } else {
          carScene.classList.remove('animate');
        }
      });
    },
    { threshold: 0.35 }
  );

  observer.observe(carScene);
});
