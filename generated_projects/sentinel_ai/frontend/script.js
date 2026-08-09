document.addEventListener('DOMContentLoaded', () => {
    // 1. Smooth scrolling for navigation links
    const navLinks = document.querySelectorAll('.nav-link, .navbar-logo, .footer-logo, .footer-links a, .footer-contact a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const hash = this.hash;
            if (hash && document.querySelector(hash)) {
                e.preventDefault();
                const targetElement = document.querySelector(hash);
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // 2. Intersection Observer for fade-up animations
    const fadeElements = document.querySelectorAll('.fade-up');

    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observerCallback = (entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        });
    };

    const observer = new IntersectionObserver(observerCallback, observerOptions);
    fadeElements.forEach(el => {
        el.classList.add('fade-up-initial'); // Add initial hidden state for JS-controlled animations
        observer.observe(el);
    });

    // 3. Parallax effect for hero background
    const heroSection = document.querySelector('.hero-section');
    const heroBackground = document.querySelector('.hero-background');

    if (heroSection && heroBackground) {
        let mouseX = 0;
        let mouseY = 0;
        let targetX = 0;
        let targetY = 0;

        heroSection.addEventListener('mousemove', (e) => {
            const rect = heroSection.getBoundingClientRect();
            mouseX = (e.clientX - rect.left) - (rect.width / 2);
            mouseY = (e.clientY - rect.top) - (rect.height / 2);
        });

        function animateParallax() {
            targetX += (mouseX * -0.005 - targetX) * 0.1;
            targetY += (mouseY * -0.005 - targetY) * 0.1;

            heroBackground.style.transform = `translate(${targetX}px, ${targetY}px) scale(1.05)`;
            requestAnimationFrame(animateParallax);
        }
        animateParallax();
    }

    // 4. Optional animated particle canvas
    const particleCanvas = document.getElementById('particle-canvas');
    if (particleCanvas) {
        const ctx = particleCanvas.getContext('2d');
        let particles = [];
        const particleCount = 50;
        const colors = [
            'hsla(119, 99%, 46%, 0.3)', // Primary green subtle
            'hsla(0, 0%, 96%, 0.1)', // Near-white subtle
            'hsla(119, 99%, 46%, 0.15)' // Slightly brighter green
        ];

        function resizeCanvas() {
            particleCanvas.width = window.innerWidth;
            particleCanvas.height = window.innerHeight;
        }

        class Particle {
            constructor() {
                this.x = Math.random() * particleCanvas.width;
                this.y = Math.random() * particleCanvas.height;
                this.size = Math.random() * 1.5 + 0.5; // Small particles
                this.speedX = Math.random() * 0.2 - 0.1; // Very slow movement
                this.speedY = Math.random() * 0.2 - 0.1;
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                this.x += this.speedX;
                this.y += this.speedY;

                if (this.x < 0 || this.x > particleCanvas.width) this.speedX *= -1;
                if (this.y < 0 || this.y > particleCanvas.height) this.speedY *= -1;
            }

            draw() {
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function initParticles() {
            particles = [];
            for (let i = 0; i < particleCount; i++) {
                particles.push(new Particle());
            }
        }

        function animateParticles() {
            ctx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();
            }
            requestAnimationFrame(animateParticles);
        }

        window.addEventListener('resize', () => {
            resizeCanvas();
            initParticles();
        });

        resizeCanvas();
        initParticles();
        animateParticles();
    }

    // 5. FAQ Accordion functionality
    const accordionHeaders = document.querySelectorAll('.accordion-header');

    accordionHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const item = header.closest('.accordion-item');
            const content = item.querySelector('.accordion-content');
            const isExpanded = header.getAttribute('aria-expanded') === 'true';

            // Close all other open accordions
            document.querySelectorAll('.accordion-item.active').forEach(openItem => {
                if (openItem !== item) {
                    openItem.classList.remove('active');
                    openItem.querySelector('.accordion-header').setAttribute('aria-expanded', 'false');
                    openItem.querySelector('.accordion-content').style.maxHeight = null;
                }
            });

            // Toggle current accordion
            item.classList.toggle('active');
            header.setAttribute('aria-expanded', !isExpanded);

            if (item.classList.contains('active')) {
                content.style.maxHeight = content.scrollHeight + 'px';
            } else {
                content.style.maxHeight = null;
            }
        });
    });

    // 6. Contact Form Submission
    const contactForm = document.getElementById('contactForm');
    const formMessage = document.getElementById('form-message');
    const submitBtn = contactForm ? contactForm.querySelector('.submit-btn') : null;

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (!submitBtn) return;

            submitBtn.disabled = true;
            formMessage.textContent = 'Sending message...';
            formMessage.style.color = 'var(--muted-foreground)';

            const formData = new FormData(contactForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await fetch('/api/contact', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    formMessage.textContent = 'Message sent successfully! We will get back to you shortly.';
                    formMessage.style.color = 'var(--primary)';
                    contactForm.reset();
                } else {
                    const errorData = await response.json();
                    formMessage.textContent = `Failed to send message: ${errorData.message || response.statusText}`;
                    formMessage.style.color = 'var(--destructive)';
                }
            } catch (error) {
                formMessage.textContent = 'An error occurred. Please try again later.';
                formMessage.style.color = 'var(--destructive)';
                console.error('Contact form submission error:', error);
            } finally {
                submitBtn.disabled = false;
            }
        });
    }
});