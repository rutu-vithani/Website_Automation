document.addEventListener('DOMContentLoaded', () => {
    // --- Smooth Scroll for Nav Links ---
    document.querySelectorAll('a.nav-link, .logo, .hero-actions .btn').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href && href.startsWith('#')) {
                e.preventDefault();
                const targetId = href.substring(1);
                const targetElement = document.getElementById(targetId);
                if (targetElement) {
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
                // Close mobile menu if open
                if (document.body.classList.contains('nav-open')) {
                    document.body.classList.remove('nav-open');
                    document.querySelector('.hamburger-menu').classList.remove('is-active');
                }
            }
        });
    });

    // --- Sticky Header & Active Nav Link Highlighting ---
    const header = document.querySelector('.header');
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('main section');

    // Sticky Header
    const heroSection = document.getElementById('hero');
    if (heroSection) {
        const heroObserver = new IntersectionObserver(
            ([entry]) => {
                if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
                    header.classList.add('scrolled');
                } else {
                    header.classList.remove('scrolled');
                }
            },
            { threshold: 0.1, rootMargin: '-50px 0px 0px 0px' } // Adjust rootMargin to trigger slightly before hero top
        );
        heroObserver.observe(heroSection);
    }

    // Active Nav Link Highlighting
    const observerOptions = {
        root: null,
        rootMargin: '-50% 0px -50% 0px', // When section is in the middle 50% of viewport
        threshold: 0
    };

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(link => link.classList.remove('active'));
                const activeLink = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
                if (activeLink) {
                    activeLink.classList.add('active');
                }
            }
        });
    }, observerOptions);

    sections.forEach(section => {
        sectionObserver.observe(section);
    });

    // --- Mobile Menu Toggle ---
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const navMenu = document.querySelector('.nav-menu');

    if (hamburgerMenu && navMenu) {
        hamburgerMenu.addEventListener('click', () => {
            hamburgerMenu.classList.toggle('is-active');
            document.body.classList.toggle('nav-open'); // Use body class for full-screen overlay control
        });

        // Close menu when a nav link is clicked
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                hamburgerMenu.classList.remove('is-active');
                document.body.classList.remove('nav-open');
            });
        });
    }

    // --- IntersectionObserver-based Scroll Animations ---
    const animateElements = document.querySelectorAll('[data-animation]');

    const animationObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = entry.target;
                const animationType = target.dataset.animation;
                const delay = parseInt(target.dataset.delay) || 0;

                setTimeout(() => {
                    if (animationType === 'char-reveal') {
                        target.querySelectorAll('span span').forEach((char, index) => {
                            char.style.transitionDelay = `${index * 0.03}s`; // Stagger characters
                            char.classList.add('animate-visible');
                        });
                    } else {
                        target.classList.add('animate-visible');
                    }
                }, delay);

                observer.unobserve(target); // Only animate once
            }
        });
    }, { threshold: 0.1 }); // Trigger when 10% of element is visible

    // Prepare char-reveal elements
    document.querySelectorAll('[data-animation="char-reveal"]').forEach(element => {
        const words = element.querySelectorAll('span');
        words.forEach(word => {
            const text = word.textContent;
            word.innerHTML = ''; // Clear original content
            text.split('').forEach(char => {
                const charSpan = document.createElement('span');
                charSpan.textContent = char;
                charSpan.style.display = 'inline-block'; // Ensure characters animate individually
                word.appendChild(charSpan);
            });
        });
        animationObserver.observe(element);
    });

    // Observe other animated elements
    animateElements.forEach(element => {
        if (element.dataset.animation !== 'char-reveal') {
            animationObserver.observe(element);
        }
    });

    // --- Magnetic Hover Effect ---
    document.querySelectorAll('.magnetic-effect').forEach(el => {
        el.addEventListener('mousemove', function (e) {
            const rect = this.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const moveX = (x - centerX) * 0.15; // Adjust multiplier for strength
            const moveY = (y - centerY) * 0.15;

            this.style.transform = `translate(${moveX}px, ${moveY}px)`;
        });

        el.addEventListener('mouseleave', function () {
            this.style.transform = `translate(0px, 0px)`;
        });
    });

    // --- Contact Form Submission ---
    const contactForm = document.getElementById('contactForm');
    const formMessage = document.getElementById('formMessage');
    const formSubmitBtn = contactForm ? contactForm.querySelector('.form-submit-btn') : null;

    if (contactForm && formMessage && formSubmitBtn) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            formSubmitBtn.disabled = true;
            formSubmitBtn.textContent = 'Sending...';
            formMessage.textContent = '';
            formMessage.classList.remove('success', 'error');

            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(data),
                });

                if (response.ok) {
                    const result = await response.json();
                    formMessage.textContent = result.message || 'Message sent successfully!';
                    formMessage.classList.add('success');
                    contactForm.reset();
                } else {
                    const errorData = await response.json();
                    formMessage.textContent = errorData.message || 'Failed to send message. Please try again.';
                    formMessage.classList.add('error');
                }
            } catch (error) {
                console.error('Submission error:', error);
                formMessage.textContent = 'An unexpected error occurred. Please try again later.';
                formMessage.classList.add('error');
            } finally {
                formSubmitBtn.disabled = false;
                formSubmitBtn.textContent = 'Send Message';
            }
        });
    }
});