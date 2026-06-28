(function(){
  "use strict";

  // ---------- Mobile menu ----------
  var navToggle = document.querySelector('.nav-toggle');
  var mobileMenu = document.querySelector('.mobile-menu');
  if(navToggle && mobileMenu){
    navToggle.addEventListener('click', function(){
      mobileMenu.classList.toggle('show');
    });
    mobileMenu.addEventListener('click', function(e){
      if(e.target.tagName === 'A') mobileMenu.classList.remove('show');
    });
  }

  // ---------- Reveal-on-scroll ----------
  var revealEls = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if(revealEls.length){
    revealEls.forEach(function(el){
      var delay = el.getAttribute('data-delay') || '0';
      el.style.transitionDelay = delay + 'ms';
    });
    if('IntersectionObserver' in window){
      var revealIO = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            entry.target.classList.add('is-visible');
            revealIO.unobserve(entry.target);
          }
        });
      }, {threshold:0.12, rootMargin:'0px 0px -7% 0px'});
      revealEls.forEach(function(el){ revealIO.observe(el); });
    } else {
      revealEls.forEach(function(el){ el.classList.add('is-visible'); });
    }
  }

  // ---------- Mobile auto-scrolling carousels ----------
  // Stats / testimonials / "what we know" become a one-card-at-a-time
  // horizontal carousel on phones that advances on its own. Dots are built
  // for all of them but CSS only shows them ≤600px. Auto-advance + dot
  // sync + pause-on-touch are all gated to the mobile breakpoint.
  var mobileMQ = window.matchMedia('(max-width:600px)');
  function onMobile(){ return mobileMQ.matches; }

  function Carousel(rail, items, dotsWrap){
    var self = this;
    self.items = items;
    self.dots  = dotsWrap ? [].slice.call(dotsWrap.querySelectorAll('.swipe-dot')) : [];
    self.idx   = 0;
    self.dir   = 1;
    self.pauseUntil = 0;
    self.visible = true;
    var st = null;

    function indexFromScroll(){
      var rr = rail.getBoundingClientRect();
      var center = rr.left + rr.width / 2;
      var best = 0, bd = Infinity;
      items.forEach(function(it, i){
        var r = it.getBoundingClientRect();
        var d = Math.abs((r.left + r.width / 2) - center);
        if(d < bd){ bd = d; best = i; }
      });
      return best;
    }
    function paint(i){
      self.dots.forEach(function(d, k){ d.classList.toggle('on', k === i); });
    }
    self.goTo = function(i){
      i = (i % items.length + items.length) % items.length;
      self.idx = i;
      var it = items[i];
      var rr = rail.getBoundingClientRect();
      var ir = it.getBoundingClientRect();
      var delta = (ir.left - rr.left) - (rail.clientWidth - it.offsetWidth) / 2;
      rail.scrollTo({ left: rail.scrollLeft + delta, behavior: 'smooth' });
      paint(i);
    };

    // dot clicks jump + pause auto-advance briefly
    self.dots.forEach(function(d, i){
      d.addEventListener('click', function(){
        self.pauseUntil = Date.now() + 6000;
        self.goTo(i);
      });
    });

    // keep dots in sync while the user swipes manually
    rail.addEventListener('scroll', function(){
      if(st) return;
      st = requestAnimationFrame(function(){
        st = null;
        var i = indexFromScroll();
        self.idx = i;
        paint(i);
      });
    }, { passive: true });

    // pause auto-advance whenever the user is interacting
    ['touchstart', 'pointerdown', 'wheel'].forEach(function(ev){
      rail.addEventListener(ev, function(){ self.pauseUntil = Date.now() + 6000; }, { passive: true });
    });

    // only auto-advance while the carousel is on screen
    if('IntersectionObserver' in window){
      new IntersectionObserver(function(es){
        es.forEach(function(e){ self.visible = e.isIntersecting; });
      }, { threshold: 0.25 }).observe(rail);
    }

    self.tick = function(){
      if(!onMobile() || !self.visible) return;
      if(Date.now() < self.pauseUntil) return;
      if(self.idx >= items.length - 1) self.dir = -1;
      else if(self.idx <= 0) self.dir = 1;
      self.goTo(self.idx + self.dir);
    };
  }

  var carousels = [];
  [
    { rail: '.stats-grid',   item: '.stat-card',  auto: true  },
    { rail: '.testi-grid',   item: '.testi-card', auto: true  },
    { rail: '.why-grid',     item: '.why-row',    auto: true  },
    { rail: '.pricing-grid', item: '.price-card', auto: false }
  ].forEach(function(cfg){
    [].slice.call(document.querySelectorAll(cfg.rail)).forEach(function(rail){
      var items = [].slice.call(rail.querySelectorAll(cfg.item));
      if(items.length < 2) return;

      var wrap = document.createElement('div');
      wrap.className = 'swipe-dots';
      var block = rail.closest('.section-block');
      if(block && block.classList.contains('gold'))   wrap.classList.add('on-gold');
      if(block && block.classList.contains('purple')) wrap.classList.add('on-purple');
      items.forEach(function(_, i){
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'swipe-dot' + (i === 0 ? ' on' : '');
        b.setAttribute('aria-label', 'Slide ' + (i + 1));
        wrap.appendChild(b);
      });
      rail.parentNode.insertBefore(wrap, rail.nextSibling);

      var c = new Carousel(rail, items, wrap);
      c.auto = cfg.auto;       // pricing swipes manually; others auto-advance
      carousels.push(c);
    });
  });

  if(carousels.length){
    setInterval(function(){
      carousels.forEach(function(c){ if(c.auto) c.tick(); });
    }, 3200);
  }

  // ---------- Scroll-travelling companion (side-switching + CTA paste) ----------
  var companion  = document.querySelector('.companion');
  var compInner  = companion ? companion.querySelector('.companion-inner') : null;

  if(companion && compInner){
    var isDesktop  = window.innerWidth > 900;
    var compSide   = 'right';
    var isPasted   = false;
    var scrollRaf  = null;
    var popTimer   = null;

    function gutter(){
      return Math.max(10, (window.innerWidth - 1240) / 2 - 64);
    }
    function rightPx(){ return window.innerWidth - gutter() - (companion.offsetWidth || 150); }
    function leftPx(){  return gutter(); }

    function setLeftInstant(px){
      companion.style.transition = 'none';
      companion.style.right      = 'auto';
      companion.style.left       = px + 'px';
      requestAnimationFrame(function(){ companion.style.transition = ''; });
    }

    function switchSide(side){
      if(side === compSide || isPasted) return;
      compSide = side;
      companion.style.right = 'auto';
      companion.style.left  = (side === 'right' ? rightPx() : leftPx()) + 'px';
      if(popTimer) clearTimeout(popTimer);
      companion.classList.remove('pop');
      void companion.offsetWidth;
      companion.classList.add('pop');
      popTimer = setTimeout(function(){ companion.classList.remove('pop'); }, 560);
    }

    if(isDesktop) setLeftInstant(rightPx());

    function onScroll(){
      if(scrollRaf) return;
      scrollRaf = requestAnimationFrame(function(){
        scrollRaf = null;
        if(isPasted) return;
        var sy  = window.scrollY || document.documentElement.scrollTop || 0;
        var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        var p   = Math.min(1, sy / max);
        companion.style.top           = (13 + p * 66) + 'vh';
        compInner.style.transform     = 'rotate(' + (-8 + Math.sin(sy / 170) * 4.5) + 'deg)';
      });
    }
    window.addEventListener('scroll', onScroll, {passive:true});
    onScroll();

    window.addEventListener('resize', function(){
      isDesktop = window.innerWidth > 900;
      if(isDesktop && !isPasted){
        setLeftInstant(compSide === 'right' ? rightPx() : leftPx());
      } else if(!isDesktop){
        // hand position back to the stylesheet (pins it to the right corner)
        companion.style.transition = 'none';
        companion.style.left  = 'auto';
        companion.style.right = '';
      }
      onScroll();
    });

    // Section side-switching (desktop only)
    if(isDesktop && 'IntersectionObserver' in window){
      var sections   = [].slice.call(document.querySelectorAll('main > section'));
      var secVisible = new Set();

      function pickSide(){
        var vc = window.innerHeight * 0.38;
        var best = null, bestDist = Infinity;
        sections.forEach(function(s){
          if(!secVisible.has(s)) return;
          var r = s.getBoundingClientRect();
          var d = Math.abs((r.top + r.bottom) / 2 - vc);
          if(d < bestDist){ bestDist = d; best = s; }
        });
        if(best) switchSide(sections.indexOf(best) % 2 === 0 ? 'right' : 'left');
      }

      var secIO = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          if(e.isIntersecting) secVisible.add(e.target);
          else secVisible.delete(e.target);
        });
        pickSide();
      }, {threshold:0, rootMargin:'-28% 0px -28% 0px'});
      sections.forEach(function(s){ secIO.observe(s); });
      window.addEventListener('scroll', pickSide, {passive:true});
    }

    // ---- CTA paste: companion disappears → note gets pasted into the tile ----
    // Targets: .cta-band on inner pages, .js-cta on index.html
    var ctaBands = [].slice.call(document.querySelectorAll('.cta-band, .js-cta'));

    ctaBands.forEach(function(band){
      var cr = band.querySelector('.cta-right');
      if(!cr) return;
      // Only inject if not already present
      if(cr.querySelector('.cta-paste-note')) return;
      var pn = document.createElement('div');
      pn.className = 'cta-paste-note sticky-note';
      pn.innerHTML = '<div class="tape"></div>'
                   + '<div class="body"><div class="text">Booked!\n✓</div></div>';
      cr.appendChild(pn);
      // make sure parent is relatively positioned
      cr.style.position = 'relative';
    });

    if(ctaBands.length && 'IntersectionObserver' in window){
      var ctaIO = new IntersectionObserver(function(entries){
        entries.forEach(function(e){
          var pn = e.target.querySelector('.cta-paste-note');

          if(e.isIntersecting){
            // 1. Companion fades out
            isPasted                      = true;
            companion.style.opacity       = '0';
            companion.style.pointerEvents = 'none';
            // 2. After brief delay, paste note slams into the tile
            if(pn) setTimeout(function(){ pn.classList.add('pasted'); }, 200);
          } else {
            // Scrolled back past the section — peel the note off
            if(pn) pn.classList.remove('pasted');
            // Restore floating companion after peel transition
            setTimeout(function(){
              isPasted                = false;
              companion.style.opacity = '1';
            }, 380);
          }
        });
      }, {threshold: 0.3});
      ctaBands.forEach(function(b){ ctaIO.observe(b); });
    }
  }

  // ---------- Lead-types dock-and-highlight accordion ----------
  var accRows = [].slice.call(document.querySelectorAll('[data-acc-row]'));
  if(accRows.length && 'IntersectionObserver' in window){
    var intersecting = new Set();
    var activeRow    = null;

    var setRowActive = function(el, on){ el.classList.toggle('active', on); };

    var recompute = function(){
      var vc = window.innerHeight * 0.42;
      var best = null, bestDist = Infinity;
      accRows.forEach(function(r){
        if(!intersecting.has(r)) return;
        var rect = r.getBoundingClientRect();
        var d = Math.abs((rect.top + rect.bottom) / 2 - vc);
        if(d < bestDist){ bestDist = d; best = r; }
      });
      if(best){
        activeRow = best;
        accRows.forEach(function(r){ setRowActive(r, r === activeRow); });
      }
    };

    var accIO = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting) intersecting.add(e.target);
        else intersecting.delete(e.target);
      });
      recompute();
    }, {rootMargin:'-42% 0px -42% 0px', threshold:0});
    accRows.forEach(function(r){ accIO.observe(r); });

    setRowActive(accRows[0], true);
    activeRow = accRows[0];
  }

  // ---------- FAQ accordion ----------
  var faqRows = [].slice.call(document.querySelectorAll('.faq-row'));
  faqRows.forEach(function(row){
    var btn = row.querySelector('.faq-q');
    if(!btn) return;
    btn.addEventListener('click', function(){
      var wasOpen = row.classList.contains('open');
      faqRows.forEach(function(r){ r.classList.remove('open'); });
      if(!wasOpen) row.classList.add('open');
    });
  });

  // ---------- Contact form (chips + UI-only submit) ----------
  var chipButtons = [].slice.call(document.querySelectorAll('.chip[data-chip-group]'));
  chipButtons.forEach(function(chip){
    chip.addEventListener('click', function(e){
      e.preventDefault();
      var group = chip.getAttribute('data-chip-group');
      if(group === 'carrier'){
        chipButtons.filter(function(c){ return c.getAttribute('data-chip-group') === 'carrier'; })
          .forEach(function(c){ c.classList.remove('on'); });
        chip.classList.add('on');
      } else {
        chip.classList.toggle('on');
      }
    });
  });

  var contactForm  = document.querySelector('.contact-form-card form');
  var successState = document.querySelector('.success-state');
  var formCardBody = document.querySelector('.form-card-body');
  var resetBtn     = document.querySelector('.success-state .btn');
  if(contactForm && successState && formCardBody){
    contactForm.addEventListener('submit', function(e){
      e.preventDefault();
      formCardBody.classList.add('hidden');
      successState.classList.add('show');
    });
    if(resetBtn){
      resetBtn.addEventListener('click', function(){
        successState.classList.remove('show');
        formCardBody.classList.remove('hidden');
        contactForm.reset();
        chipButtons.forEach(function(c){ c.classList.remove('on'); });
      });
    }
  }
})();
