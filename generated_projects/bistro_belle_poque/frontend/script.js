html
<!-- full index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bistro Belle Époque</title>
    <link rel="stylesheet" href="style.css">
    <link rel="icon" type="image/png" sizes="32x32" href="https://images.unsplash.com/photo-1706945296688-5b6e75db9ebb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwxfHxjaGVmLXBvcnRyYWl0fGVufDB8MHx8fDE3ODI4ODE1MDF8MA&ixlib=rb-4.1.0&q=80&w=1080">
</head>
<body>
    <header id="home" class="hero">
        <img src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwxfHxyZXN0YXVyYW50LWludGVyaW9yfGVufDB8MHx8fDE3ODI4ODE0OTd8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Bistro Belle Époque's interior" class="hero-image">
        <div class="hero-content">
            <h1>Bistro Belle Époque</h1>
            <p>Experience the warmth of French cuisine in a cozy, elegant setting.</p>
            <button>Make a Reservation</button>
        </div>
    </header>
    <nav class="navbar">
        <ul>
            <li><a href="#home">Home</a></li>
            <li><a href="#about">About</a></li>
            <li><a href="#menu">Menu</a></li>
            <li><a href="#gallery">Gallery</a></li>
            <li><a href="#reservation">Reservation</a></li>
            <li><a href="#testimonials">Testimonials</a></li>
            <li><a href="#location-hours">Location & Hours</a></li>
        </ul>
    </nav>
    <section id="about" class="about">
        <h2>About Us</h2>
        <div class="about-content">
            <div class="about-image">
                <img src="https://images.unsplash.com/photo-1667388969250-1c7220bf3f37?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwyfHxyZXN0YXVyYW50LWludGVyaW9yfGVufDB8MHx8fDE3ODI4ODE0OTd8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Our chef in action" class="about-image">
            </div>
            <div class="about-text">
                <p>Bistro Belle Époque is a cozy French restaurant located in the heart of the city. Our chef, Pierre, has crafted a menu that will transport you to the streets of Paris.</p>
                <p>From our signature dishes to our extensive wine list, we invite you to experience the warmth and elegance of French cuisine.</p>
            </div>
        </div>
    </section>
    <section id="menu" class="menu">
        <h2>Our Menu</h2>
        <div class="menu-content">
            <div class="menu-tabs">
                <button class="active">Appetizers</button>
                <button>Entrees</button>
                <button> Desserts</button>
            </div>
            <div class="menu-tabs-content">
                <div class="menu-tabs-item active">
                    <h3>Appetizers</h3>
                    <ul>
                        <li>Escargots en Persillade</li>
                        <li>Steak Tartare</li>
                        <li>Fois Gras</li>
                    </ul>
                </div>
                <div class="menu-tabs-item">
                    <h3>Entrees</h3>
                    <ul>
                        <li>Coq au Vin</li>
                        <li>Boeuf Bourguignon</li>
                        <li>Filet Mignon</li>
                    </ul>
                </div>
                <div class="menu-tabs-item">
                    <h3>Desserts</h3>
                    <ul>
                        <li>Tarte Tatin</li>
                        <li>Crème Brûlée</li>
                        <li>Macarons</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>
    <section id="gallery" class="gallery">
        <h2>Our Gallery</h2>
        <div class="gallery-content">
            <div class="gallery-grid">
                <img src="https://images.unsplash.com/photo-1570560258879-af7f8e1447ac?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwzfHxyZXN0YXVyYW50LWludGVyaW9yfGVufDB8MHx8fDE3ODI4ODE0OTd8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Our chef in action" class="gallery-image">
                <img src="https://images.unsplash.com/photo-1729394405518-eaf2a0203aa7?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHw0fHxyZXN0YXVyYW50LWludGVyaW9yfGVufDB8MHx8fDE3ODI4ODE0OTd8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Our restaurant's interior" class="gallery-image">
                <img src="https://images.unsplash.com/photo-1709837167686-a2e33aad1bf0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwyfHxjaGVmLXBvcnRyYWl0fGVufDB8MHx8fDE3ODI4ODE1MDF8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Our chef's creations" class="gallery-image">
            </div>
        </div>
    </section>
    <section id="reservation" class="reservation">
        <h2>Make a Reservation</h2>
        <form>
            <label for="name">Name:</label>
            <input type="text" id="name" name="name" required>
            <label for="email">Email:</label>
            <input type="email" id="email" name="email" required>
            <label for="phone">Phone:</label>
            <input type="tel" id="phone" name="phone" required>
            <button>Make a Reservation</button>
        </form>
    </section>
    <section id="testimonials" class="testimonials">
        <h2>What Our Customers Say</h2>
        <div class="testimonials-content">
            <div class="testimonial">
                <img src="https://images.unsplash.com/photo-1538334421852-687c439c92f4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwyfHxyZXN0YXVyYW50LWFtYmllbmNlfGVufDB8MHx8fDE3ODI4ODE1MDB8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Customer testimonial" class="testimonial-image">
                <p>"Bistro Belle Époque is a hidden gem in the city. The food is exquisite and the service is top-notch."</p>
                <p>- Emily R.</p>
            </div>
            <div class="testimonial">
                <img src="https://images.unsplash.com/photo-1574966739987-65e38db0f7ce?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwzfHxyZXN0YXVyYW50LWFtYmllbmNlfGVufDB8MHx8fDE3ODI4ODE1MDB8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Customer testimonial" class="testimonial-image">
                <p>"The atmosphere at Bistro Belle Époque is cozy and inviting. The staff is friendly and attentive."</p>
                <p>- David K.</p>
            </div>
        </div>
    </section>
    <section id="location-hours" class="location-hours">
        <h2>Location & Hours</h2>
        <div class="location-hours-content">
            <div class="location">
                <h3>Address:</h3>
                <p>123 Main St, Anytown, USA</p>
            </div>
            <div class="hours">
                <h3>Hours:</h3>
                <ul>
                    <li>Monday - Thursday: 11am - 10pm</li>
                    <li>Friday - Saturday: 11am - 11pm</li>
                    <li>Sunday: 10am - 9pm</li>
                </ul>
            </div>
            <div class="pulsing-dot">
                <div class="dot"></div>
            </div>
        </div>
    </section>
    <footer>
        <div class="footer-content">
            <div class="footer-logo">
                <img src="https://images.unsplash.com/photo-1706945296688-5b6e75db9ebb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w5ODY3Mjl8MHwxfHNlYXJjaHwxfHxjaGVmLXBvcnRyYWl0fGVufDB8MHx8fDE3ODI4ODE1MDF8MA&ixlib=rb-4.1.0&q=80&w=1080" alt="Bistro Belle Époque's logo" class="footer-logo-image">
            </div>
            <div class="footer-text">
                <p>&copy; 2023 Bistro Belle Époque</p>
                <p>Follow us on social media:</p>
                <ul>
                    <li><a href="#">Facebook</a></li>
                    <li><a href="#">Instagram</a></li>
                    <li><a href="#">Twitter</a></li>
                </ul>
            </div>
        </div>
    </footer>
    <script src="script.js" defer></script>
</body>
</html>