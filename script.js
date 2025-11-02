document.addEventListener('DOMContentLoaded', () => {
  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const easeInOut = (t) => t * t * (3 - 2 * t);
  const parseProgressValue = (value, fallback) => {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? clamp01(numeric) : fallback;
  };

  const updateSegments = (segments, progress) => {
    segments.forEach((segment) => {
      const { path, start, end, length, dottedDash, solidDash } = segment;
      const range = Math.max(end - start, 0.001);
      const local = (progress - start) / range;
      const clamped = clamp01(local);

      if (clamped <= 0 && progress <= start) {
        if (segment.state !== 'dotted') {
          path.style.strokeDasharray = dottedDash;
          path.style.strokeDashoffset = '0';
          path.style.opacity = '0.22';
          segment.state = 'dotted';
        }
        return;
      }

      if (segment.state === 'dotted') {
        path.style.strokeDasharray = solidDash;
        segment.state = 'drawing';
      }

      const eased = easeInOut(clamped);
      path.style.strokeDashoffset = String((1 - eased) * length);
      path.style.opacity = String(0.25 + 0.75 * eased);

      if (clamped >= 1 && segment.state !== 'complete') {
        segment.state = 'complete';
        path.style.strokeDashoffset = '0';
        path.style.opacity = '1';
      } else if (clamped < 1 && segment.state === 'complete') {
        segment.state = 'drawing';
      }
    });
  };

  const computeSectionProgress = (section) => {
    const viewHeight = window.innerHeight || document.documentElement.clientHeight;
    const scrollTop = window.scrollY || window.pageYOffset || 0;
    const sectionTop = section.offsetTop;
    const sectionHeight = section.offsetHeight;
    const travel = sectionHeight - viewHeight;

    if (travel <= 0) {
      const rawSingle = (scrollTop + viewHeight - sectionTop) / Math.max(sectionHeight, 1);
      return clamp01(rawSingle);
    }

    const raw = (scrollTop - sectionTop) / travel;
    return clamp01(raw);
  };

  const createIllustrationController = (section) => {
    const paths = Array.from(section.querySelectorAll('svg .path'));
    if (!paths.length) {
      return null;
    }

    const segments = paths.map((path) => {
      const length = path.getTotalLength();
      path.style.setProperty('--path-length', length);
      const gap = Math.max(length / 60, 14);
      const dot = Math.max(gap * 0.35, 3);
      const dottedDash = `${dot} ${gap}`;
      path.style.strokeDasharray = dottedDash;
      path.style.strokeDashoffset = '0';
      path.style.opacity = '0.22';

      const start = parseProgressValue(path.dataset.start, 0);
      const endRaw = parseProgressValue(path.dataset.end, 1);
      const end = endRaw <= start ? clamp01(start + 0.06) : endRaw;

      return {
        path,
        length,
        dottedDash,
        solidDash: `${length} ${length}`,
        start,
        end,
        state: 'dotted',
      };
    });

    const update = () => {
      const progress = computeSectionProgress(section);
      updateSegments(segments, progress);
    };

    const complete = () => {
      segments.forEach((segment) => {
        segment.path.style.strokeDasharray = segment.solidDash;
        segment.path.style.strokeDashoffset = '0';
        segment.path.style.opacity = '1';
        segment.state = 'complete';
      });
    };

    return { update, complete };
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = Array.from(document.querySelectorAll('[data-scroll-illustration]'));
  const controllers = sections
    .map((section) => createIllustrationController(section))
    .filter((controller) => controller !== null);

  if (prefersReducedMotion) {
    controllers.forEach((controller) => controller.complete());
  } else if (controllers.length) {
    let ticking = false;

    const requestUpdate = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        controllers.forEach((controller) => controller.update());
      });
    };

    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
  }

  const carScene = document.getElementById('carScene');

  if (carScene) {
    if (prefersReducedMotion) {
      carScene.classList.add('animate');
    } else {
      const carObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              carScene.classList.add('animate');
              carObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.35 }
      );

      carObserver.observe(carScene);
    }
  }
});
