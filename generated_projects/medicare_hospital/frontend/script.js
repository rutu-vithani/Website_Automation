// Function to handle splash screen
function handleSplashScreen() {
    const splashScreen = document.getElementById('splash-screen');
    if (splashScreen) {
        window.addEventListener('load', () => {
            setTimeout(() => {
                splashScreen.classList.add('fade-out');
                splashScreen.addEventListener('transitionend', () => {
                    splashScreen.style.display = 'none';
                    document.body.classList.remove('no-scroll');
                }, { once: true });
            }, 1000); // Display splash for 1 second
        });
        document.body.classList.add('no-scroll');
    }
}

// Function to handle sticky navbar
function handleStickyNavbar() {
    const header = document.querySelector('.header');
    if (header) {
        const toggleSticky = () => {
            if (window.scrollY > 0) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        };
        window.addEventListener('scroll', toggleSticky);
        toggleSticky(); // Call on load to set initial state
    }
}

// Function to handle mobile navigation toggle
function handleMobileNav() {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            navToggle.classList.toggle('open');
            const isExpanded = navToggle.classList.contains('open');
            navToggle.setAttribute('aria-expanded', isExpanded);
            document.body.classList.toggle('no-scroll-mobile'); // Prevent scroll when mobile menu is open
        });

        // Close mobile nav when a link is clicked
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('open')) {
                    navLinks.classList.remove('open');
                    navToggle.classList.remove('open');
                    navToggle.setAttribute('aria-expanded', false);
                    document.body.classList.remove('no-scroll-mobile');
                }
            });
        });
    }
}

// Function for smooth scrolling
function handleSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                const headerOffset = document.querySelector('.header')?.offsetHeight || 0;
                const elementPosition = targetElement.getBoundingClientRect().top + window.scrollY;
                const offsetPosition = elementPosition - headerOffset - 20; // Added 20px extra padding

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Function to handle scroll reveal animations
function handleScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal');

    if (revealElements.length === 0) return;

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const delay = parseInt(entry.target.dataset.delay) || 0;
                setTimeout(() => {
                    entry.target.classList.add('active');
                }, delay);
                observer.unobserve(entry.target);
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);

    revealElements.forEach(el => observer.observe(el));
}

// Function to handle active navigation link highlighting
function handleActiveNavLinkHighlighting() {
    const sections = document.querySelectorAll('main section');
    const navLinks = document.querySelectorAll('.nav-links a');

    if (sections.length === 0 || navLinks.length === 0) return;

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
                    const linkHref = link.getAttribute('href');
                    // Handle #hero and #home pointing to the same section
                    if (linkHref === `#${currentSectionId}` || (linkHref === '#home' && currentSectionId === 'hero')) {
                        link.classList.add('active');
                    }
                });
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    sections.forEach(section => observer.observe(section));
}

// Function to handle contact form submission
function handleContactForm() {
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const formStatus = document.getElementById('formStatus');

    if (!contactForm || !submitBtn || !formStatus) return;

    const validateField = (inputElement, errorElementId) => {
        const errorElement = document.getElementById(errorElementId);
        if (!errorElement) return true;

        if (inputElement.value.trim() === '') {
            errorElement.textContent = 'This field is required.';
            inputElement.classList.add('invalid');
            return false;
        } else if (inputElement.type === 'email' && !/\S+@\S+\.\S+/.test(inputElement.value)) {
            errorElement.textContent = 'Please enter a valid email address.';
            inputElement.classList.add('invalid');
            return false;
        } else if (inputElement.tagName === 'SELECT' && inputElement.value === '') {
            errorElement.textContent = 'Please select an option.';
            inputElement.classList.add('invalid');
            return false;
        }
        errorElement.textContent = '';
        inputElement.classList.remove('invalid');
        return true;
    };

    const fieldsToValidate = [
        { id: 'name', errorId: 'nameError' },
        { id: 'email', errorId: 'emailError' },
        { id: 'service', errorId: 'serviceError' },
        { id: 'message', errorId: 'messageError' }
    ];

    fieldsToValidate.forEach(field => {
        const input = document.getElementById(field.id);
        if (input) {
            input.addEventListener('input', () => validateField(input, field.errorId));
            input.addEventListener('blur', () => validateField(input, field.errorId));
        }
    });

    contactForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        let isValid = true;
        fieldsToValidate.forEach(field => {
            const input = document.getElementById(field.id);
            if (input && !validateField(input, field.errorId)) {
                isValid = false;
            }
        });

        if (!isValid) {
            formStatus.textContent = 'Please correct the errors in the form.';
            formStatus.className = 'form-status error';
            return;
        }

        submitBtn.disabled = true;
        formStatus.textContent = 'Sending message...';
        formStatus.className = 'form-status loading';

        const formData = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            service: document.getElementById('service').value,
            message: document.getElementById('message').value
        };

        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                formStatus.textContent = 'Message sent successfully! We will get back to you shortly.';
                formStatus.className = 'form-status success';
                contactForm.reset();
                fieldsToValidate.forEach(field => {
                    const input = document.getElementById(field.id);
                    if (input) input.classList.remove('invalid');
                });
            } else {
                const errorData = await response.json();
                formStatus.textContent = `Error: ${errorData.message || 'Something went wrong. Please try again later.'}`;
                formStatus.className = 'form-status error';
            }
        } catch (error) {
            console.error('Submission error:', error);
            formStatus.textContent = 'Network error. Please check your connection and try again.';
            formStatus.className = 'form-status error';
        } finally {
            submitBtn.disabled = false;
        }
    });
}

// Initialize all functionalities when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    handleSplashScreen();
    handleStickyNavbar();
    handleMobileNav();
    handleSmoothScroll();
    handleScrollReveal();
    handleActiveNavLinkHighlighting();
    handleContactForm();
});