// Frontend Agent: Viktor Oddy - Creative Design Studio

document.addEventListener('DOMContentLoaded', () => {
    // 1. Scroll-triggered fade-in animations with IntersectionObserver
    const faders = document.querySelectorAll('.animate-fade-in-up');

    const appearOptions = {
        threshold: 0.1, // Trigger when 10% of the element is visible
        rootMargin: "0px 0px -50px 0px" // Start a bit earlier
    };

    const appearOnScroll = new IntersectionObserver(function(entries, appearOnScroll) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) {
                return;
            }
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            entry.target.style.animation = 'fadeInUp 0.8s ease-out forwards'; // Apply animation
            appearOnScroll.unobserve(entry.target);
        });
    }, appearOptions);

    faders.forEach(fader => {
        appearOnScroll.observe(fader);
    });

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // 2. Infinite Marquee Animation (CSS handles the animation for .marquee-track)
    // No specific JS needed here as the HTML structure and CSS animation are set.

    // 3. Testimonial Carousel
    const testimonialsData = [
        {
            quote: "With very little guidance, the team delivered designs that were consistently spot on. Every detail felt considered, sharp, and ready for market.",
            name: "Marcus Anderson",
            role: "CEO, Data.storage",
            avatar: "https://source.unsplash.com/200x200/?man,portrait,professional"
        },
        {
            quote: "Viktor led the creation of our best fundraising deck to date. The work gave our story clarity and made the product feel much bigger.",
            name: "Alex Wu",
            role: "Founder, Nexgate",
            avatar: "https://source.unsplash.com/200x200/?founder,portrait"
        },
        {
            quote: "Working with Viktor transformed our product vision. The site finally felt like the company we were trying to become.",
            name: "James Mitchell",
            role: "VP Product, LaunchPad",
            avatar: "https://source.unsplash.com/200x200/?business,portrait"
        },
        {
            quote: "The design quality exceeded our expectations. It was clean, strategic, and built around the way our buyers actually think.",
            name: "Rachel Foster",
            role: "Co-founder, Nexus Labs",
            avatar: "https://source.unsplash.com/200x200/?woman,founder,portrait"
        },
        {
            quote: "Incredible work from start to finish. The process was fast, calm, and the final result looked like a much larger studio made it.",
            name: "David Zhang",
            role: "Head of Design, Paradigm Labs",
            avatar: "https://source.unsplash.com/200x200/?designer,portrait"
        }
    ];

    const carouselTrack = document.querySelector('.carousel-track');
    const prevButton = document.querySelector('.carousel-button-prev');
    const nextButton = document.querySelector('.carousel-button-next');
    const testimonialsSection = document.getElementById('testimonials');

    if (carouselTrack && prevButton && nextButton && testimonialsSection) {
        // Triplicate testimonials for infinite scroll effect
        const fullTestimonials = [...testimonialsData, ...testimonialsData, ...testimonialsData];
        let currentIndex = testimonialsData.length; // Start at the first 'real' set

        function createTestimonialCard(testimonial) {
            const card = document.createElement('div');
            card.classList.add('testimonial-card');
            card.innerHTML = `
                <svg class="card-quote-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M7.75 18C7.75 19.1046 6.85457 20 5.75 20C4.64543 20 3.75 19.1046 3.75 18V12C3.75 9.10051 6.00051 6.75 8.89949 6.75H9.25C9.66421 6.75 10 6.36421 10 5.95C10 5.53579 9.66421 5.15 9.25 5.15H8.89949C5.12288 5.15 2 8.35821 2 12V18C2 19.933 3.567 21.5 5.5 21.5C7.433 21.5 9 19.933 9 18V14.75H7.75V18ZM17.75 18C17.75 19.1046 16.8546 20 15.75 20C14.6454 20 13.75 19.1046 13.75 18V12C13.75 9.10051 16.0005 6.75 18.8995 6.75H19.25C19.6642 6.75 20 6.36421 20 5.95C20 5.53579 19.6642 5.15 19.25 5.15H18.8995C15.1229 5.15 12 8.35821 12 12V18C12 19.933 13.567 21.5 15.5 21.5C17.433 21.5 19 19.933 19 18V14.75H17.75V18Z" fill="var(--color-primary-dark)"/>
                </svg>
                <p class="testimonial-quote">${testimonial.quote}</p>
                <div class="testimonial-author">
                    <img src="${testimonial.avatar}" alt="${testimonial.name} avatar" class="author-avatar" loading="lazy">
                    <div class="author-info">
                        <span class="author-name">${testimonial.name}</span>
                        <span class="author-role">&rarr; ${testimonial.role}</span>
                    </div>
                </div>
            `;
            return card;
        }

        fullTestimonials.forEach(testimonial => {
            carouselTrack.appendChild(createTestimonialCard(testimonial));
        });

        const updateCarousel = (smooth = true) => {
            const cardWidth = carouselTrack.children[0].offsetWidth + 24; // Card width + gap
            carouselTrack.style.transition = smooth ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none';
            carouselTrack.style.transform = `translateX(-${currentIndex * cardWidth}px)`;
        };

        const goToNext = () => {
            currentIndex++;
            updateCarousel();
        };

        const goToPrev = () => {
            currentIndex--;
            updateCarousel();
        };

        let autoScrollInterval;
        const startAutoScroll = () => {
            autoScrollInterval = setInterval(() => {
                goToNext();
            }, 3000);
        };

        const pauseAutoScroll = () => {
            clearInterval(autoScrollInterval);
        };

        // Infinite loop logic
        carouselTrack.addEventListener('transitionend', () => {
            if (currentIndex >= testimonialsData.length * 2) {
                currentIndex = testimonialsData.length;
                updateCarousel(false); // Jump without transition
            } else if (currentIndex < testimonialsData.length) {
                currentIndex = testimonialsData.length * 2 - 1; // Jump to end of second set
                updateCarousel(false); // Jump without transition
            }
        });

        // Event listeners
        prevButton.addEventListener('click', () => {
            pauseAutoScroll();
            goToPrev();
            startAutoScroll(); // Restart after manual interaction
        });
        nextButton.addEventListener('click', () => {
            pauseAutoScroll();
            goToNext();
            startAutoScroll(); // Restart after manual interaction
        });

        testimonialsSection.addEventListener('mouseenter', pauseAutoScroll);
        testimonialsSection.addEventListener('mouseleave', startAutoScroll);

        // Initial setup
        updateCarousel(false); // Set initial position without animation
        startAutoScroll();

        // Recalculate position on resize
        window.addEventListener('resize', () => {
            updateCarousel(false);
        });
    }

    // 4. Parallax image movement in the quote section
    const parallaxImageWrapper = document.querySelector('.parallax-image-wrapper');
    const parallaxImage = document.querySelector('.parallax-image');

    if (parallaxImageWrapper && parallaxImage) {
        let currentScrollY = window.scrollY;
        let rAF;

        const parallaxEffect = () => {
            const rect = parallaxImageWrapper.getBoundingClientRect();
            const viewportHeight = window.innerHeight;

            // Check if image is in viewport
            const inViewport = rect.top < viewportHeight && rect.bottom > 0;

            if (inViewport) {
                // Calculate how much the image wrapper is in the viewport, from 0 to 1
                const scrollProgress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
                const offset = scrollProgress * 200 - 100; // Max offset 200px, centered

                parallaxImage.style.transform = `translateY(${offset}px)`;
            }

            currentScrollY = window.scrollY;
            rAF = requestAnimationFrame(parallaxEffect);
        };

        // Start parallax when section enters viewport
        const parallaxObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    rAF = requestAnimationFrame(parallaxEffect);
                } else {
                    cancelAnimationFrame(rAF);
                }
            });
        }, { threshold: 0.1 });

        parallaxObserver.observe(parallaxImageWrapper);
    }

    // 5. Partner section hover image trail
    const partnerContainer = document.querySelector('.partner-container');
    const marqueeImageUrlsForHover = [
        "https://source.unsplash.com/150x150/?creative,studio",
        "https://source.unsplash.com/150x150/?product,design",
        "https://source.unsplash.com/150x150/?architecture,abstract",
        "https://source.unsplash.com/150x150/?modern,workspace",
        "https://source.unsplash.com/150x150/?design,process",
        "https://source.unsplash.com/150x150/?minimal,interior",
        "https://source.unsplash.com/150x150/?technology,design",
        "https://source.unsplash.com/150x150/?futuristic,building",
    ];

    if (partnerContainer) {
        let lastSpawnTime = 0;
        const spawnInterval = 80; // ms

        partnerContainer.addEventListener('mousemove', (e) => {
            const currentTime = Date.now();
            if (currentTime - lastSpawnTime < spawnInterval) {
                return;
            }
            lastSpawnTime = currentTime;

            const img = document.createElement('img');
            img.src = marqueeImageUrlsForHover[Math.floor(Math.random() * marqueeImageUrlsForHover.length)];
            img.alt = "Hover effect image";
            img.classList.add('hover-image');
            
            // Position relative to the partner-container
            const containerRect = partnerContainer.getBoundingClientRect();
            const x = e.clientX - containerRect.left;
            const y = e.clientY - containerRect.top;

            img.style.left = `${x}px`;
            img.style.top = `${y}px`;
            img.style.transform = `translate(-50%, -50%) rotate(${Math.random() * 20 - 10}deg)`; // Random rotation -10 to 10 deg
            img.style.opacity = '1';
            img.style.transition = 'none'; // Disable transition for initial placement
            
            partnerContainer.appendChild(img);

            // Trigger fade out and scale down animation
            requestAnimationFrame(() => {
                img.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
                img.style.opacity = '0';
                img.style.transform += ' scale(0.5)'; // Scale down
            });

            // Remove element after animation ends
            setTimeout(() => {
                img.remove();
            }, 1000);
        });
    }

    // 6. Smooth button hover states (handled by CSS transitions)
    // No specific JS needed here.

    // 7. Mobile responsive behavior (mostly CSS, no specific JS for menu toggle as no hamburger menu in HTML)
});