// Function to handle smooth scrolling for anchor links
function setupSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                const header = document.querySelector('.header');
                const headerHeight = header ? header.offsetHeight : 0;

                const elementPosition = targetElement.getBoundingClientRect().top + window.pageYOffset;
                const offsetPosition = elementPosition - headerHeight - 20; // Add some extra padding

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });

                const navLinks = document.querySelector('.nav-links');
                const navToggle = document.querySelector('.nav-toggle');
                if (navLinks && navLinks.classList.contains('nav-open')) {
                    navLinks.classList.remove('nav-open');
                    if (navToggle) {
                        navToggle.setAttribute('aria-expanded', 'false');
                    }
                    document.body.classList.remove('no-scroll');
                }
            }
        });
    });
}

// Function to handle sticky header on scroll
function setupStickyHeader() {
    const header = document.querySelector('.header');
    if (!header) return;

    const scrollThreshold = 100;

    const updateHeader = () => {
        if (window.scrollY > scrollThreshold) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    };

    window.addEventListener('scroll', updateHeader);
    updateHeader();
}

// Function to handle mobile navigation toggle
function setupMobileNav() {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');
    const body = document.body;

    if (!navToggle || !navLinks) return;

    navToggle.addEventListener('click', () => {
        const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
        navToggle.setAttribute('aria-expanded', !isExpanded);
        navLinks.classList.toggle('nav-open');
        body.classList.toggle('no-scroll');
    });
}

// Function to handle IntersectionObserver for reveal animations
function setupRevealAnimations() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const revealElements = document.querySelectorAll('.reveal-element');

    if (revealElements.length === 0 || prefersReducedMotion) {
        revealElements.forEach(el => el.classList.add('is-visible'));
        return;
    }

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = parseInt(entry.target.dataset.delay || '0');
                setTimeout(() => {
                    entry.target.classList.add('is-visible');
                }, delay);
                observer.unobserve(entry.target);
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    revealElements.forEach(el => observer.observe(el));
}

// Function to handle FAQ accordion
function setupFaqAccordion() {
    document.querySelectorAll('.accordion-item').forEach(item => {
        const header = item.querySelector('.accordion-header');
        const panel = item.querySelector('.accordion-panel');

        if (!header || !panel) return;

        header.addEventListener('click', () => {
            const isOpen = item.classList.contains('is-open');

            document.querySelectorAll('.accordion-item.is-open').forEach(openItem => {
                if (openItem !== item) {
                    openItem.classList.remove('is-open');
                    openItem.querySelector('.accordion-header').setAttribute('aria-expanded', 'false');
                    openItem.querySelector('.accordion-panel').setAttribute('aria-hidden', 'true');
                    openItem.querySelector('.accordion-panel').style.maxHeight = null;
                }
            });

            item.classList.toggle('is-open');
            header.setAttribute('aria-expanded', !isOpen);
            panel.setAttribute('aria-hidden', isOpen);

            if (!isOpen) {
                panel.style.maxHeight = panel.scrollHeight + 'px';
            } else {
                panel.style.maxHeight = null;
            }
        });
    });
}

// Function to handle contact form submission
function setupContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const formStatus = document.getElementById('formStatus');
    const submitBtn = form.querySelector('.form-submit-btn');

    const validateEmail = (email) => {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    };

    const showError = (element, message) => {
        const errorDiv = document.getElementById(element.id + 'Error');
        if (errorDiv) {
            errorDiv.textContent = message;
            element.classList.add('invalid');
        }
    };

    const clearError = (element) => {
        const errorDiv = document.getElementById(element.id + 'Error');
        if (errorDiv) {
            errorDiv.textContent = '';
            element.classList.remove('invalid');
        }
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        let isValid = true;
        const formData = new FormData(form);
        const data = {};

        form.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
        if (formStatus) {
            formStatus.textContent = '';
            formStatus.className = 'form-status-message';
        }

        const nameInput = document.getElementById('name');
        if (!nameInput.value.trim()) {
            showError(nameInput, 'Name is required.');
            isValid = false;
        } else {
            clearError(nameInput);
        }

        const emailInput = document.getElementById('email');
        if (!emailInput.value.trim()) {
            showError(emailInput, 'Email is required.');
            isValid = false;
        } else if (!validateEmail(emailInput.value)) {
            showError(emailInput, 'Please enter a valid email address.');
            isValid = false;
        } else {
            clearError(emailInput);
        }

        const messageInput = document.getElementById('message');
        if (!messageInput.value.trim()) {
            showError(messageInput, 'Message is required.');
            isValid = false;
        } else {
            clearError(messageInput);
        }

        if (!isValid) {
            if (formStatus) {
                formStatus.textContent = 'Please correct the errors above.';
                formStatus.classList.add('error');
            }
            return;
        }

        formData.forEach((value, key) => {
            data[key] = value;
        });

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending...';
        }
        if (formStatus) {
            formStatus.textContent = 'Sending your message...';
            formStatus.classList.remove('error', 'success');
        }

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                const result = await response.json();
                if (formStatus) {
                    formStatus.textContent = result.message || 'Message sent successfully!';
                    formStatus.classList.add('success');
                }
                form.reset();
            } else {
                const errorData = await response.json();
                throw new Error(errorData.message || `Server error: ${response.status}`);
            }
        } catch (error) {
            console.error('Form submission error:', error);
            if (formStatus) {
                formStatus.textContent = `Failed to send message: ${error.message}`;
                formStatus.classList.add('error');
            }
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Message';
            }
        }
    });
}

// Function to handle active navigation link highlighting
function setupActiveNavLinkHighlighting() {
    const navLinks = document.querySelectorAll('.nav-links .nav-link');
    const sections = document.querySelectorAll('main section, header');

    if (navLinks.length === 0 || sections.length === 0) return;

    const observerOptions = {
        root: null,
        rootMargin: '-50% 0px -49% 0px',
        threshold: 0
    };

    const observerCallback = (entries) => {
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
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    sections.forEach(section => observer.observe(section));
}

// Initialize all functionalities when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    setupSmoothScrolling();
    setupStickyHeader();
    setupMobileNav();
    setupRevealAnimations();
    setupFaqAccordion();
    setupContactForm();
    setupActiveNavLinkHighlighting();
});