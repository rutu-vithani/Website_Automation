document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.header');
    const navLinks = document.querySelectorAll('.nav-menu__link');
    const sections = document.querySelectorAll('section[id]');
    const hamburgerBtn = document.querySelector('.header__hamburger');
    const navMenu = document.querySelector('.nav-menu');
    const contactForm = document.getElementById('contactForm');
    const mortgageForm = document.querySelector('.mortgage-form');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // --- Header Scroll State and Sticky Navbar ---
    function handleHeaderScroll() {
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    }
    window.addEventListener('scroll', handleHeaderScroll);
    handleHeaderScroll(); // Initial check on load

    // --- Smooth Scroll for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Close mobile menu if open
                if (navMenu.classList.contains('nav-menu--open')) {
                    navMenu.classList.remove('nav-menu--open');
                    hamburgerBtn.classList.remove('header__hamburger--active');
                    hamburgerBtn.setAttribute('aria-expanded', 'false');
                    document.body.classList.remove('no-scroll');
                }

                const headerOffset = header.offsetHeight;
                const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
                const offsetPosition = elementPosition - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });

    // --- Mobile Menu Toggle ---
    if (hamburgerBtn && navMenu) {
        hamburgerBtn.addEventListener('click', () => {
            const isExpanded = hamburgerBtn.getAttribute('aria-expanded') === 'true';
            hamburgerBtn.setAttribute('aria-expanded', !isExpanded);
            navMenu.classList.toggle('nav-menu--open');
            hamburgerBtn.classList.toggle('header__hamburger--active');
            document.body.classList.toggle('no-scroll'); // Prevent background scroll
        });
    }

    // --- Active Navigation Link Highlighting ---
    const observerOptions = {
        root: null,
        rootMargin: `-${header.offsetHeight + 1}px 0px -75% 0px`, // Adjust to activate when section top is just below header
        threshold: 0 // Observe as soon as any part of the section enters the rootMargin
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        let activeSectionId = null;

        // Find the section that is currently most visible in the top part of the viewport
        // This prioritizes sections appearing higher up or being larger
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Check if the section is truly 'above' the bottom margin of the rootMargin
                // and if it's the highest one currently
                const rect = entry.target.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const headerHeight = header.offsetHeight;

                // A section is "active" if its top is above the header and visible,
                // and its bottom is below the header.
                // We'll prioritize the first section whose top is past the header.
                if (rect.top <= headerHeight && rect.bottom > headerHeight) {
                    activeSectionId = entry.target.id;
                }
            }
        });

        // Fallback for when no specific section is in the primary active zone (e.g., at the very top)
        if (!activeSectionId && window.scrollY < document.getElementById('hero').offsetHeight / 2) {
            activeSectionId = 'hero';
        }

        navLinks.forEach(link => {
            if (link.getAttribute('href') === `#${activeSectionId}`) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }, observerOptions);

    sections.forEach(section => sectionObserver.observe(section));

    // --- Section Reveal Animations (Fade-in) ---
    function setupScrollRevealAnimations() {
        if (prefersReducedMotion.matches) {
            sections.forEach(section => section.classList.add('is-visible')); // Immediately show
            return;
        }

        const sectionsToAnimate = document.querySelectorAll('.section:not(#hero)');
        const revealObserverOptions = {
            root: null,
            rootMargin: '0px',
            threshold: 0.15 // Trigger when 15% of the section is visible
        };

        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, revealObserverOptions);

        sectionsToAnimate.forEach(section => {
            section.classList.add('animate-on-scroll'); // Class for initial hidden state in CSS
            revealObserver.observe(section);
        });
        document.querySelector('#hero').classList.add('is-visible'); // Hero is visible by default
    }
    setupScrollRevealAnimations();


    // --- Contact Form Submission ---
    if (contactForm) {
        const formStatus = document.querySelector('.form-status');

        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            formStatus.textContent = '';
            document.querySelectorAll('.form-error').forEach(span => span.textContent = '');

            let isValid = true;
            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            const messageInput = document.getElementById('message');
            const phoneInput = document.getElementById('phone');

            if (!nameInput.value.trim()) {
                document.getElementById('name-error').textContent = 'Name is required.';
                isValid = false;
            }
            if (!emailInput.value.trim() || !/\S+@\S+\.\S+/.test(emailInput.value)) {
                document.getElementById('email-error').textContent = 'Please enter a valid email address.';
                isValid = false;
            }
            if (!messageInput.value.trim()) {
                document.getElementById('message-error').textContent = 'Message is required.';
                isValid = false;
            }
            if (phoneInput.value.trim() && !/^\+?(\d[\s-]?)?(\(?\d{3}\)?[\s-]?)?[\d\s-]{7,10}\d$/.test(phoneInput.value)) {
                document.getElementById('phone-error').textContent = 'Please enter a valid phone number.';
                isValid = false;
            }

            if (!isValid) {
                formStatus.textContent = 'Please correct the errors above.';
                formStatus.style.color = 'var(--color-accent)';
                return;
            }

            formStatus.textContent = 'Sending message...';
            formStatus.style.color = 'var(--color-primary)';

            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                if (response.ok) {
                    formStatus.textContent = 'Message sent successfully! We will get back to you shortly.';
                    formStatus.style.color = 'var(--color-success)';
                    contactForm.reset();
                } else {
                    const errorData = await response.json();
                    formStatus.textContent = `Error: ${errorData.message || 'Something went wrong. Please try again.'}`;
                    formStatus.style.color = 'var(--color-accent)';
                }
            } catch (error) {
                formStatus.textContent = 'Network error. Please check your connection and try again.';
                formStatus.style.color = 'var(--color-accent)';
                console.error('Contact form submission error:', error);
            }
        });
    }

    // --- Mortgage Calculator Logic ---
    if (mortgageForm) {
        const loanAmountInput = document.getElementById('loan-amount');
        const interestRateInput = document.getElementById('interest-rate');
        const loanTermInput = document.getElementById('loan-term');
        const mortgageResultAmount = document.querySelector('.mortgage-result__amount');

        function calculateMortgage() {
            const P = parseFloat(loanAmountInput.value);
            const annualRate = parseFloat(interestRateInput.value);
            const N = parseInt(loanTermInput.value);

            if (isNaN(P) || isNaN(annualRate) || isNaN(N) || P <= 0 || annualRate < 0 || N <= 0) {
                mortgageResultAmount.textContent = '$0.00';
                return;
            }

            const r = (annualRate / 100) / 12; // Monthly interest rate
            const n = N * 12; // Total number of payments

            let monthlyPayment;
            if (r === 0) {
                monthlyPayment = P / n; // Simple division if interest rate is 0
            } else {
                monthlyPayment = P * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
            }

            if (isNaN(monthlyPayment) || !isFinite(monthlyPayment)) {
                mortgageResultAmount.textContent = 'Invalid Input';
            } else {
                mortgageResultAmount.textContent = `$${monthlyPayment.toFixed(2)}`;
            }
        }

        mortgageForm.addEventListener('submit', function (e) {
            e.preventDefault();
            calculateMortgage();
        });

        loanAmountInput.addEventListener('input', calculateMortgage);
        interestRateInput.addEventListener('input', calculateMortgage);
        loanTermInput.addEventListener('change', calculateMortgage);

        calculateMortgage(); // Initial calculation on load
    }
});