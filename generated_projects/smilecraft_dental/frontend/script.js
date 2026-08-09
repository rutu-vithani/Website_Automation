// Global constants for image URLs and data
const HERO_IMAGE = "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260624_113640_ccf3cf97-d447-425b-a134-d7b09fc743fc.png&w=1280&q=85";
const SECTION2_IMAGE = "https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260624_114219_414dfe80-f15c-4e25-bf52-b13721f4bd88.png&w=1280&q=85";
// SECTION3_IMG1, SECTION3_IMG2, SECTION3_BG are already set as data-src in HTML for lazy loading

const services = [
    { name: "Dental\nVeneers", num: "01", active: true },
    { name: "Dental\nCrowns", num: "02", active: false },
    { name: "Teeth\nWhitening", num: "03", active: false },
    { name: "Dental\nImplants", num: null, active: false }
];

// --- Responsive Detection Helper ---
const mediaQuery = window.matchMedia("(max-width:767px)");
let isMobile = mediaQuery.matches;

function updateIsMobile() {
    isMobile = mediaQuery.matches;
}

mediaQuery.addEventListener('change', updateIsMobile);
updateIsMobile(); // Initial check

// --- Body Scroll Locking ---
function disableBodyScroll() {
    document.body.classList.add('no-scroll');
}

function enableBodyScroll() {
    document.body.classList.remove('no-scroll');
}

// --- Smooth Scrolling ---
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        if (targetElement) {
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
            // Close mobile menu if open
            if (mobileNavOverlay.classList.contains('open')) {
                toggleMobileNav(false);
            }
        }
    });
});

// --- Splash Screen Animation ---
const splashScreen = document.getElementById('splash-screen');
const splashCounter = splashScreen ? splashScreen.querySelector('.splash-counter') : null;

if (splashScreen && splashCounter) {
    let count = 0;
    const duration = 2000; // ms
    const incrementInterval = 20; // ms
    const totalIncrements = duration / incrementInterval;
    const incrementValue = 100 / totalIncrements;

    const counterInterval = setInterval(() => {
        count += incrementValue;
        if (count >= 100) {
            count = 100;
            splashCounter.textContent = Math.round(count);
            clearInterval(counterInterval);
            setTimeout(() => {
                splashScreen.style.opacity = '0';
                setTimeout(() => {
                    splashScreen.remove();
                }, 700); // Fade duration
            }, 200); // Wait after reaching 100
        } else {
            splashCounter.textContent = Math.round(count);
        }
    }, incrementInterval);
}


// --- Navbar Functionality ---
const navbar = document.getElementById('navbar');
const navToggle = document.querySelector('.nav-toggle');
const mobileNavOverlay = document.getElementById('mobile-nav-overlay');

function toggleMobileNav(isOpen) {
    if (isOpen === undefined) { // Toggle if no explicit state is given
        isOpen = !mobileNavOverlay.classList.contains('open');
    }

    if (isOpen) {
        mobileNavOverlay.classList.add('open');
        navToggle.classList.add('active');
        disableBodyScroll();
        // Stagger animation for mobile nav links
        document.querySelectorAll('.mobile-nav-menu ul li').forEach((item, index) => {
            item.style.transitionDelay = `${index * 80}ms`;
            item.classList.add('animate-in'); // Add a class for animation
        });
    } else {
        mobileNavOverlay.classList.remove('open');
        navToggle.classList.remove('active');
        enableBodyScroll();
        document.querySelectorAll('.mobile-nav-menu ul li').forEach(item => {
            item.classList.remove('animate-in');
            item.style.transitionDelay = ''; // Clear delay
        });
    }
}

if (navToggle) {
    navToggle.addEventListener('click', () => toggleMobileNav());
}

if (mobileNavOverlay) {
    mobileNavOverlay.addEventListener('click', (e) => {
        // Close if backdrop is clicked, not the menu itself
        if (e.target === mobileNavOverlay) {
            toggleMobileNav(false);
        }
    });
}


// Sticky Navbar
if (navbar) {
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) { // Add scrolled class after 50px scroll
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        lastScrollY = window.scrollY;
    });
}


// --- Shared Masked Background System (Sections 1 & 2) ---
const maskedCards = document.querySelectorAll('.masked-card');
const heroBgPreloader = document.getElementById('hero-bg-preloader');
const galleryBgPreloader = document.getElementById('gallery-bg-preloader');

let heroBgImageLoaded = false;
let galleryBgImageLoaded = false;

// Preload images and store dimensions
const bgImages = {
    1: { url: HERO_IMAGE, img: new Image(), naturalWidth: 0, naturalHeight: 0, loaded: false },
    2: { url: SECTION2_IMAGE, img: new Image(), naturalWidth: 0, naturalHeight: 0, loaded: false }
};

function loadMaskedBgImages() {
    Object.values(bgImages).forEach(bg => {
        bg.img.onload = () => {
            bg.naturalWidth = bg.img.naturalWidth;
            bg.naturalHeight = bg.img.naturalHeight;
            bg.loaded = true;
            if (Object.values(bgImages).every(b => b.loaded)) {
                calculateMaskedCardBackgrounds();
            }
        };
        bg.img.src = bg.url;
    });
}

function calculateMaskedCardBackgrounds() {
    maskedCards.forEach(card => {
        const sectionId = parseInt(card.dataset.maskedBgSection);
        const sectionElement = document.getElementById(sectionId === 1 ? 'home' : 'gallery');
        const bgData = bgImages[sectionId];

        if (!sectionElement || !bgData || !bgData.loaded) return;

        const sectionRect = sectionElement.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();

        const focalPointDesktop = 0.8;
        const focalPointMobileSection1 = 0.7;
        const focalPointMobileSection2 = 0.65;

        let currentFocalPoint = focalPointDesktop;
        if (isMobile) {
            currentFocalPoint = (sectionId === 1) ? focalPointMobileSection1 : focalPointMobileSection2;
        }

        // Calculate background size relative to the section, then scale by focal point
        // and express it as a percentage relative to the card's dimensions.
        // We want the *entire section's* background to be scaled by focal point,
        // then the card acts as a window into that scaled section background.
        // So, the background image on the card needs to be scaled to cover the *section*
        // at the focal point, and then its position offset.

        // Calculate the effective size of the background image across the entire section
        const effectiveBgWidth = sectionRect.width * currentFocalPoint;
        const effectiveBgHeight = sectionRect.height * currentFocalPoint;

        // Calculate the background-size for the card relative to its own dimensions
        // This is (effectiveBgSize / cardSize) * 100%
        const bgSizeX = (effectiveBgWidth / cardRect.width) * 100;
        const bgSizeY = (effectiveBgHeight / cardRect.height) * 100;

        // Calculate the offset of the card relative to the section's top-left corner
        const cardOffsetLeftInSection = cardRect.left - sectionRect.left;
        const cardOffsetTopInSection = cardRect.top - sectionRect.top;

        // Calculate background-position for the card
        // This is -(cardOffsetInSection * focalPoint)
        const bgPosX = -(cardOffsetLeftInSection * currentFocalPoint);
        const bgPosY = -(cardOffsetTopInSection * currentFocalPoint);

        card.style.backgroundImage = `url(${bgData.url})`;
        card.style.backgroundSize = `${bgSizeX}% ${bgSizeY}%`;
        card.style.backgroundPosition = `${bgPosX}px ${bgPosY}px`;
        card.style.backgroundRepeat = 'no-repeat';
    });
}

// Use ResizeObserver for more efficient updates if available
if (typeof ResizeObserver !== 'undefined') {
    const resizeObserver = new ResizeObserver(entries => {
        calculateMaskedCardBackgrounds();
    });
    document.querySelectorAll('.hero-section, .gallery-section').forEach(section => {
        resizeObserver.observe(section);
    });
} else {
    window.addEventListener('resize', calculateMaskedCardBackgrounds);
}

// Initial load for images and calculations
document.addEventListener('DOMContentLoaded', loadMaskedBgImages);
window.addEventListener('load', calculateMaskedCardBackgrounds); // Ensure calculation after all images and layout are stable


// --- Scroll Reveal Animation ---
const revealSections = document.querySelectorAll('.reveal-section');
const revealItems = document.querySelectorAll('.reveal-item');

const observerOptions = {
    root: null,
    rootMargin: '0px',
    threshold: 0.1 // Trigger when 10% of the element is visible
};

const sectionObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // Animate once
        }
    });
}, observerOptions);

const itemObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const delayIndex = parseInt(entry.target.dataset.delayIndex) || 0;
            entry.target.style.transitionDelay = `${delayIndex * 120}ms`;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // Animate once
        }
    });
}, observerOptions);

revealSections.forEach(section => {
    sectionObserver.observe(section);
});

revealItems.forEach(item => {
    itemObserver.observe(item);
});


// --- Dynamic Service Cards (Section 2) ---
const serviceListContainer = document.querySelector('.service-list');

if (serviceListContainer) {
    services.forEach(service => {
        const serviceCard = document.createElement('div');
        serviceCard.classList.add('service-card');
        if (service.active) {
            serviceCard.classList.add('active');
        } else {
            serviceCard.classList.add('glass-card');
        }

        const numSpan = document.createElement('span');
        numSpan.classList.add('service-num');
        numSpan.textContent = service.num || '';

        const nameSpan = document.createElement('span');
        nameSpan.classList.add('service-name');
        nameSpan.innerHTML = service.name.replace(/\n/g, '<br>');

        serviceCard.appendChild(numSpan);
        serviceCard.appendChild(nameSpan);
        serviceListContainer.appendChild(serviceCard);
    });
}

// --- Lazy Load Non-Critical Images (data-src to src) ---
// The HTML already uses loading="lazy". This will ensure data-src is used as src.
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('img[data-src]').forEach(img => {
        img.src = img.dataset.src;
    });
});

// --- Navbar Active Link Highlighting (Optional, but good UX) ---
// This is not explicitly requested but is a standard 'premium' feature for sticky navs
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a, .mobile-nav-overlay a');

const highlightNavObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) { // Highlight when at least 50% visible
            const currentSectionId = entry.target.id;
            navLinks.forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${currentSectionId}`) {
                    link.classList.add('active');
                }
            });
        }
    });
}, { threshold: 0.5, rootMargin: '-50% 0px -49% 0px' }); // Adjust rootMargin to make it activate when section is roughly in the middle

sections.forEach(section => {
    highlightNavObserver.observe(section);
});

// Initial active link set on load for the first section
window.addEventListener('load', () => {
    if (sections.length > 0) {
        navLinks.forEach(link => link.classList.remove('active'));
        const firstNavLink = document.querySelector(`.nav-links a[href="#${sections[0].id}"]`);
        if (firstNavLink) firstNavLink.classList.add('active');
    }
});