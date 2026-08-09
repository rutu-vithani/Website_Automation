// full script.js
// Add event listener to all links
document.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        if (href.startsWith('#')) {
            const sectionId = href.substring(1);
            const section = document.getElementById(sectionId);
            section.scrollIntoView({ behavior: 'smooth' });
        }
    });
});