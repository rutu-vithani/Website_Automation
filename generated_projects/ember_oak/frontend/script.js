// Global setup for prefers-reduced-motion
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// --- Smooth Scroll Navigation ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);

        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: prefersReducedMotion ? 'auto' : 'smooth'
            });

            // Close mobile menu if open
            const headerNav = document.querySelector('.header__nav');
            const menuToggle = document.querySelector('.header__menu-toggle');
            if (headerNav && menuToggle && headerNav.classList.contains('header__nav--open')) {
                headerNav.classList.remove('header__nav--open');
                menuToggle.setAttribute('aria-expanded', 'false');
                document.body.classList.remove('no-scroll');
            }
        }
    });
});

// --- Sticky Navbar & Background Change ---
const header = document.querySelector('.header');
const heroSection = document.getElementById('home');

if (header && heroSection) {
    const heroObserverOptions = {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1 // When 10% of the hero is visible
    };

    const heroObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                header.classList.add('header--scrolled');
            } else {
                header.classList.remove('header--scrolled');
            }
        });
    }, heroObserverOptions);

    heroObserver.observe(heroSection);
}

// --- Mobile Menu Toggle ---
const menuToggle = document.querySelector('.header__menu-toggle');
const headerNav = document.querySelector('.header__nav');

if (menuToggle && headerNav) {
    menuToggle.addEventListener('click', () => {
        const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
        headerNav.classList.toggle('header__nav--open');
        menuToggle.setAttribute('aria-expanded', !isExpanded);
        document.body.classList.toggle('no-scroll'); // Prevent scrolling when menu is open
    });

    // Close menu when a nav link is clicked inside the mobile menu
    headerNav.querySelectorAll('.header__nav-link').forEach(link => {
        link.addEventListener('click', () => {
            headerNav.classList.remove('header__nav--open');
            menuToggle.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('no-scroll');
        });
    });
}


// --- Section Reveal Animations (IntersectionObserver) ---
const revealSections = document.querySelectorAll('.reveal-section');

if (!prefersReducedMotion) {
    const revealObserverOptions = {
        root: null, // viewport
        rootMargin: '0px',
        threshold: 0.1 // Trigger when 10% of the section is visible
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Stop observing once visible
            }
        });
    }, revealObserverOptions);

    revealSections.forEach(section => {
        revealObserver.observe(section);
    });
} else {
    // If prefers-reduced-motion is enabled, make all sections immediately visible
    revealSections.forEach(section => {
        section.classList.add('is-visible');
        section.classList.remove('reveal-section');
    });
}


// --- Active Nav Link Highlighting (IntersectionObserver) ---
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.header__nav-link');

if (sections.length > 0 && navLinks.length > 0) {
    const navObserverOptions = {
        root: null,
        rootMargin: '-50% 0px -50% 0px', // When section is in the middle 50% of viewport
        threshold: 0 // We just need to know if it crosses the middle line
    };

    const navObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const currentSectionId = entry.target.id;
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${currentSectionId}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, navObserverOptions);

    sections.forEach(section => {
        navObserver.observe(section);
    });
}


// --- Contact Form Submission ---
const reservationForm = document.getElementById('reservationForm');
const formStatus = document.getElementById('formStatus');

if (reservationForm && formStatus) {
    reservationForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!reservationForm.checkValidity()) {
            formStatus.textContent = 'Please fill out all required fields correctly.';
            formStatus.style.color = 'var(--color-error, #d9534f)'; // Fallback color
            return;
        }

        const formData = new FormData(reservationForm);
        const data = Object.fromEntries(formData.entries());
        
        const submitButton = reservationForm.querySelector('.form__submit-button');
        submitButton.disabled = true;
        formStatus.textContent = 'Sending reservation request...';
        formStatus.style.color = 'var(--color-text-dark, #333)'; // Neutral color for sending state

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (response.ok) {
                formStatus.textContent = 'Reservation confirmed! We look forward to seeing you.';
                formStatus.style.color = 'var(--color-success, #5cb85c)'; // Fallback color
                reservationForm.reset();
            } else {
                const errorData = await response.json();
                formStatus.textContent = `Reservation failed: ${errorData.message || 'Something went wrong.'}`;
                formStatus.style.color = 'var(--color-error, #d9534f)'; // Fallback color
            }
        } catch (error) {
            formStatus.textContent = 'Reservation failed: Could not connect to the server.';
            formStatus.style.color = 'var(--color-error, #d9534f)'; // Fallback color
            console.error('Form submission error:', error);
        } finally {
            submitButton.disabled = false;
        }
    });
}