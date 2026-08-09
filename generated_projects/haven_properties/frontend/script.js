html
<!-- full index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Haven Properties</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <nav class="navbar">
        <div class="logo">Haven Properties</div>
        <ul class="nav-links">
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#properties">Properties</a></li>
            <li><a href="#testimonials">Testimonials</a></li>
            <li><a href="#contact">Contact</a></li>
        </ul>
        <button class="cta-button">Get Started</button>
    </nav>
    <section id="home" class="hero">
        <img src="https://images.unsplash.com/photo-1531971589569-0d9370cbe1e5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwxfHxsdXh1cnklMjBob21lc3xlbnwwfDB8fHwxNzgyODE5MTQ2fDA&ixlib=rb-4.1.0&q=80&w=1080" alt="Luxury Homes">
        <h1>Welcome to Haven Properties</h1>
        <p>Experience the art of luxury real estate with us.</p>
        <button class="cta-button">Explore Our Properties</button>
    </section>
    <section id="about" class="about">
        <h2>About Us</h2>
        <p>Haven Properties is a luxury real estate agency dedicated to providing exceptional service and expertise to our clients. Our team of experienced professionals is committed to helping you find your dream home.</p>
        <img src="https://images.unsplash.com/photo-1505843513577-22bb7d21e455?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwyfHxsdXh1cnklMjBob21lc3xlbnwwfDB8fHwxNzgyODE5MTQ2fDA&ixlib=rb-4.1.0&q=80&w=1080" alt="Modern Architecture">
    </section>
    <section id="properties" class="properties">
        <h2>Properties</h2>
        <div class="property-grid">
            <div class="property-card">
                <img src="https://images.unsplash.com/photo-1706808849780-7a04fbac83ef?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwzfHxsdXh1cnklMjBob21lc3xlbnwwfDB8fHwxNzgyODE5MTQ2fDA&ixlib=rb-4.1.0&q=80&w=1080" alt="Luxury Homes">
                <h3>Property 1</h3>
                <p>$1,000,000</p>
                <button class="cta-button">View Details</button>
            </div>
            <div class="property-card">
                <img src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHw0fHxsdXh1cnklMjBob21lc3xlbnwwfDB8fHwxNzgyODE5MTQ2fDA&ixlib=rb-4.1.0&q=80&w=1080" alt="Luxury Homes">
                <h3>Property 2</h3>
                <p>$1,500,000</p>
                <button class="cta-button">View Details</button>
            </div>
        </div>
    </section>
    <section id="testimonials" class="testimonials">
        <h2>Testimonials</h2>
        <div class="testimonial-grid">
            <div class="testimonial-card">
                <img src="https://images.unsplash.com/photo-1488972685288-c3fd157d7c7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBhcmNoaXRlY3R1cmV8ZW58MHwwfHx8MTc4MjgxOTE0N3ww&ixlib=rb-4.1.0&q=80&w=1080" alt="Real Estate Agents">
                <h3>John Doe</h3>
                <p>Haven Properties exceeded my expectations with their exceptional service and expertise.</p>
            </div>
            <div class="testimonial-card">
                <img src="https://images.unsplash.com/photo-1487958449943-2429e8be8625?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwyfHxtb2Rlcm4lMjBhcmNoaXRlY3R1cmV8ZW58MHwwfHx8MTc4MjgxOTE0N3ww&ixlib=rb-4.1.0&q=80&w=1080" alt="Real Estate Agents">
                <h3>Jane Doe</h3>
                <p>I highly recommend Haven Properties for their professionalism and dedication to their clients.</p>
            </div>
        </div>
    </section>
    <section id="contact" class="contact">
        <h2>Contact Us</h2>
        <form>
            <input type="text" placeholder="Name">
            <input type="email" placeholder="Email">
            <textarea placeholder="Message"></textarea>
            <button class="cta-button">Send Message</button>
        </form>
    </section>
    <footer>
        <p>&copy; 2023 Haven Properties</p>
    </footer>
    <script src="script.js"></script>
</body>
</html>