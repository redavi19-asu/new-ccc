document.documentElement.classList.add('has-js');

document.addEventListener('DOMContentLoaded', () => {
  const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
  const easeInOut = (t) => t * t * (3 - 2 * t);
  const lerp = (start, end, t) => start + (end - start) * t;
  const rangeProgress = (value, start, end) => clamp01((value - start) / Math.max(end - start, 0.0001));
  const easeRange = (value, start, end) => easeInOut(rangeProgress(value, start, end));
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

    section.style.setProperty('--scroll-progress', '0');

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
      section.style.setProperty('--scroll-progress', String(progress));
      updateSegments(segments, progress);
    };

    const complete = () => {
      section.style.setProperty('--scroll-progress', '1');
      segments.forEach((segment) => {
        segment.path.style.strokeDasharray = segment.solidDash;
        segment.path.style.strokeDashoffset = '0';
        segment.path.style.opacity = '1';
        segment.state = 'complete';
      });
    };

    return { update, complete };
  };

  const computeGlobalProgress = () => {
    const doc = document.documentElement;
    const scrollTop = window.scrollY || doc.scrollTop || 0;
    const maxScroll = Math.max(doc.scrollHeight - window.innerHeight, 0);

    if (maxScroll <= 0) {
      return 1;
    }

    return clamp01(scrollTop / maxScroll);
  };

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sections = Array.from(document.querySelectorAll('[data-scroll-illustration]'));
  const controllers = sections
    .map((section) => createIllustrationController(section))
    .filter((controller) => controller !== null);

  const trackers = [];

  const createSectionTracker = (element, onUpdate) => {
    if (!element || typeof onUpdate !== 'function') {
      return null;
    }

    element.style.setProperty('--section-progress', '0');

    return {
      update(globalProgress) {
        const localProgress = computeSectionProgress(element);
        element.style.setProperty('--section-progress', String(localProgress));
        onUpdate(localProgress, globalProgress);
      },
      complete() {
        element.style.setProperty('--section-progress', '1');
        onUpdate(1, 1);
      },
    };
  };

  const hero = document.querySelector('.hero');

  if (hero) {
    const heroContent = hero.querySelector('.hero__content');
    const heroAnimation = hero.querySelector('.hero__animation');
    const heroLanes = Array.from(hero.querySelectorAll('.hero__lane'));
    const heroCar = hero.querySelector('.vehicle--car');
    const heroSuv = hero.querySelector('.vehicle--suv');
    const heroCarWheels = heroCar ? Array.from(heroCar.querySelectorAll('.vehicle__wheel')) : [];
    const heroSuvWheels = heroSuv ? Array.from(heroSuv.querySelectorAll('.vehicle__wheel')) : [];

    const heroTracker = createSectionTracker(hero, (progress) => {
      const contentProgress = easeRange(progress, 0.08, 0.92);
      const heroProgress = easeRange(progress, 0.02, 1);
      const laneLead = easeRange(progress, 0.08, 0.85);
      const laneTrail = easeRange(progress, 0.3, 1);

      if (heroContent) {
        heroContent.style.setProperty('--content-progress', String(contentProgress));
      }

      if (heroAnimation) {
        heroAnimation.style.setProperty('--hero-progress', String(heroProgress));
      }

      heroLanes.forEach((lane, index) => {
        const laneProgress = index === 0 ? laneLead : laneTrail;
        lane.style.setProperty('--lane-progress', String(laneProgress));
      });

      if (heroCar) {
        const carProgress = easeRange(progress, 0.04, 0.75);
        const carX = lerp(120, -36, carProgress);
        heroCar.style.transform = `translate3d(${carX}%, -50%, 0)`;
        heroCarWheels.forEach((wheel) => {
          wheel.style.setProperty('--wheel-rotation', `${lerp(0, 720, carProgress)}deg`);
        });
      }

      if (heroSuv) {
        const suvProgress = easeRange(progress, 0.35, 1);
        const suvX = lerp(-240, 22, suvProgress);
        heroSuv.style.transform = `translate3d(${suvX}%, -50%, 0)`;
        heroSuvWheels.forEach((wheel) => {
          wheel.style.setProperty('--wheel-rotation', `${lerp(0, 720, suvProgress)}deg`);
        });
      }
    });

    if (heroTracker) {
      trackers.push(heroTracker);
    }
  }

  const carScene = document.getElementById('carScene');

  if (carScene) {
    const car = carScene.querySelector('.car');
    const carWheels = car ? Array.from(car.querySelectorAll('.car__wheel')) : [];
    const charger = carScene.querySelector('.charger');
    const cable = carScene.querySelector('.charger__cable');

    const carTracker = createSectionTracker(carScene, (progress) => {
      const sceneProgress = easeRange(progress, 0.05, 1);
      const carProgress = easeRange(progress, 0.12, 0.86);
      const chargerProgress = easeRange(progress, 0.32, 1);
      const cableProgress = easeRange(progress, 0.42, 1);

      carScene.style.setProperty('--scene-progress', String(sceneProgress));

      if (car) {
        const carX = lerp(-140, 0, carProgress);
        car.style.transform = `translateX(${carX}%)`;
      }

      carWheels.forEach((wheel) => {
        wheel.style.setProperty('--wheel-rotation', `${lerp(0, 900, carProgress)}deg`);
      });

      if (charger) {
        charger.style.setProperty('--charger-progress', String(chargerProgress));
      }

      if (cable) {
        const cableTilt = lerp(10, 0, cableProgress);
        cable.style.transform = `rotate(${cableTilt}deg)`;
      }
    });

    if (carTracker) {
      trackers.push(carTracker);
    }
  }

  const infoBlocks = Array.from(document.querySelectorAll('.info-block'));

  infoBlocks.forEach((block) => {
    const blockTracker = createSectionTracker(block, (progress) => {
      const blockProgress = easeRange(progress, 0.1, 1);
      block.style.setProperty('--block-progress', String(blockProgress));
    });

    if (blockTracker) {
      trackers.push(blockTracker);
    }
  });

  if (prefersReducedMotion) {
    controllers.forEach((controller) => controller.complete());
    trackers.forEach((tracker) => tracker.complete());
    document.body.style.setProperty('--global-progress', '1');
  } else if (controllers.length || trackers.length) {
    let ticking = false;

    const updateAll = () => {
      const globalProgress = computeGlobalProgress();
      document.body.style.setProperty('--global-progress', String(globalProgress));
      controllers.forEach((controller) => controller.update());
      trackers.forEach((tracker) => tracker.update(globalProgress));
    };

    const requestUpdate = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        updateAll();
      });
    };

    updateAll();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
  }
});
