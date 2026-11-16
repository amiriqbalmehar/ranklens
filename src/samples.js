/**
 * samples.js — a realistic sample page for the demo.
 *
 * A small local plumbing business homepage, deliberately imperfect:
 * the title is too long, there is no meta description, there are two H1s,
 * one image has no alt text, and the content is a little thin. Running
 * the audit on it shows a mix of errors, warnings and passes — exactly
 * what the demo video needs.
 */

export const SAMPLE_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Best Emergency Plumber Austin TX | 24/7 Plumbing Repairs, Drain Cleaning &amp; Water Heater Installation Services</title>
</head>
<body>
<header>
<h1>Apex Plumbing — Emergency Plumber in Austin</h1>
<nav>
<a href="/">Home</a>
<a href="/services">Services</a>
<a href="/about">About Us</a>
<a href="/contact">Contact</a>
</nav>
</header>
<main>
<h1>Fast, Honest Plumbing Help — Day or Night</h1>
<p>When a pipe bursts at 2am, you need a plumber who actually answers the phone. Apex Plumbing has served Austin homes and small businesses since 2011. Our licensed plumbers fix leaks, clear drains, repair water heaters, and handle full repiping jobs.</p>
<h2>What We Fix</h2>
<p>Leaky taps, running toilets, blocked drains, low water pressure, burst pipes, and water heaters that have given up. We explain the problem in plain words, quote a fixed price before we start, and clean up when we finish.</p>
<h4>Why Homeowners Choose Apex</h4>
<p>Every job is backed by a 12-month workmanship guarantee. No call-out fee inside the city limits, and no surprise charges on the invoice.</p>
<img src="/images/van.jpg" alt="Apex Plumbing service van in Austin">
<img src="/images/team.jpg">
<p>Call us now for same-day service across Austin, Round Rock, and Cedar Park. Emergency lines are open 24 hours a day, 7 days a week.</p>
<a href="/book">Book a plumber</a>
<a href="https://www.example-reviews-site.com/apex-plumbing">Read our reviews</a>
</main>
<footer>
<p>Apex Plumbing, 412 Congress Ave, Austin, TX. Licensed &amp; insured. TX Master Plumber License M-39821.</p>
</footer>
</body>
</html>`;

export const SAMPLE_KEYWORD = "emergency plumber Austin";

export const SAMPLE_URL = "https://apex-plumbing-example.com/";
