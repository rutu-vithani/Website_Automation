document.addEventListener('DOMContentLoaded', () => {

    // --- Navbar Scroll State & Active Link Highlighting ---
    const header = document.querySelector('.header');
    const navLinks = document.querySelectorAll('.nav-links .nav-link');
    const sections = document.querySelectorAll('main section'); // Target all main sections

    if (header && sections.length > 0 && navLinks.length > 0) {
        // Update Navbar scroll state (add/remove 'scrolled' class)
        const updateNavbarScrollState = () => {
            if (window.scrollY > 50) { // Scroll threshold
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        };

        // Initial check and attach scroll listener
        updateNavbarScrollState();
        window.addEventListener('scroll', updateNavbarScrollState);

        // Intersection Observer for active nav links
        const observerOptions = {
            root: null,
            rootMargin: `-50% 0px -50% 0px`, // Trigger when the middle of the section crosses the middle of the viewport
            threshold: 0 // Trigger as soon as any part of the section enters/leaves
        };

        const sectionObserver = new IntersectionObserver((entries) => {
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
        }, observerOptions);

        sections.forEach(section => {
            sectionObserver.observe(section);
        });
    }


    // --- Smooth Scroll for Anchor Links ---
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);

            if (targetElement) {
                // Close mobile menu if open
                const navToggle = document.querySelector('.nav-toggle');
                const navLinksContainer = document.querySelector('.nav-links');
                if (navToggle && navLinksContainer && navLinksContainer.classList.contains('nav-links--open')) {
                    navLinksContainer.classList.remove('nav-links--open');
                    navToggle.classList.remove('nav-toggle--active');
                    navToggle.setAttribute('aria-expanded', 'false');
                    document.body.classList.remove('no-scroll');
                }

                // Smooth scroll
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });

                // Update URL hash without jumping
                history.pushState(null, '', targetId);
            }
        });
    });


    // --- Mobile Menu Toggle ---
    const navToggle = document.querySelector('.nav-toggle');
    const navLinksContainer = document.querySelector('.nav-links');

    if (navToggle && navLinksContainer) {
        navToggle.addEventListener('click', () => {
            const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', !isExpanded);
            navLinksContainer.classList.toggle('nav-links--open');
            navToggle.classList.toggle('nav-toggle--active');
            document.body.classList.toggle('no-scroll'); // Prevent body scroll when menu is open
        });
    }


    // --- IntersectionObserver-based Reveal Animations ---
    const revealElements = document.querySelectorAll('.reveal-on-scroll');

    if (revealElements.length > 0) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const delay = parseInt(entry.target.dataset.delay) || 0;
                    setTimeout(() => {
                        entry.target.classList.add('is-visible');
                    }, delay);
                    observer.unobserve(entry.target); // Stop observing once visible
                }
            });
        }, {
            threshold: 0.1, // Trigger when 10% of the element is visible
            rootMargin: '0px 0px -10% 0px' // Start revealing a bit earlier
        });

        revealElements.forEach(element => {
            revealObserver.observe(element);
        });
    }


    // --- Contact Form Submission ---
    const contactForm = document.getElementById('contactForm');
    const formStatus = document.getElementById('formStatus');

    if (contactForm && formStatus) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            let isValid = true;
            formStatus.textContent = ''; // Clear previous messages
            formStatus.className = 'form-status'; // Reset class for styling

            // Client-side validation
            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            const messageInput = document.getElementById('message');

            const nameError = document.getElementById('nameError');
            const emailError = document.getElementById('emailError');
            const messageError = document.getElementById('messageError');

            // Reset error messages and invalid states
            [nameError, emailError, messageError].forEach(el => el && (el.textContent = ''));
            [nameInput, emailInput, messageInput].forEach(el => el && el.classList.remove('invalid'));

            if (!nameInput || !nameInput.value.trim()) {
                if (nameError) nameError.textContent = 'Name is required.';
                if (nameInput) nameInput.classList.add('invalid');
                isValid = false;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailInput || !emailInput.value.trim() || !emailRegex.test(emailInput.value.trim())) {
                if (emailError) emailError.textContent = 'Please enter a valid email address.';
                if (emailInput) emailInput.classList.add('invalid');
                isValid = false;
            }

            if (!messageInput || !messageInput.value.trim()) {
                if (messageError) messageError.textContent = 'Message is required.';
                if (messageInput) messageInput.classList.add('invalid');
                isValid = false;
            }

            if (!isValid) {
                formStatus.textContent = 'Please correct the errors in the form.';
                formStatus.classList.add('error');
                return;
            }

            const submitButton = contactForm.querySelector('.contact-form__submit');
            if (submitButton) submitButton.disabled = true;
            formStatus.textContent = 'Sending message...';
            formStatus.classList.add('loading');

            const formData = {
                name: nameInput ? nameInput.value.trim() : '',
                email: emailInput ? emailInput.value.trim() : '',
                phone: document.getElementById('phone') ? document.getElementById('phone').value.trim() : '',
                message: messageInput ? messageInput.value.trim() : ''
            };

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(formData)
                });

                if (response.ok) {
                    const result = await response.json();
                    formStatus.textContent = result.message || 'Message sent successfully!';
                    formStatus.classList.add('success');
                    contactForm.reset(); // Clear form fields
                } else {
                    const errorData = await response.json();
                    formStatus.textContent = errorData.message || 'Failed to send message. Please try again.';
                    formStatus.classList.add('error');
                }
            } catch (error) {
                console.error('Network or server error:', error);
                formStatus.textContent = 'A network error occurred. Please try again later.';
                formStatus.classList.add('error');
            } finally {
                if (submitButton) submitButton.disabled = false;
                formStatus.classList.remove('loading');
            }
        });
    }

    // --- Newsletter Form Submission (basic handling) ---
    const newsletterForm = document.querySelector('.newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const emailInput = newsletterForm.querySelector('input[type="email"]');
            if (emailInput && emailInput.value.trim()) {
                alert(`Thank you for subscribing with: ${emailInput.value.trim()}`);
                emailInput.value = '';
            } else {
                alert('Please enter a valid email address.');
            }
        });
    }
});