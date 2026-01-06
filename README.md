# Kopare Website

Landing page for the Kopare mobile app - helping families navigate shared schedules, expenses, and communication.

## Setup Instructions

### Adding Images

To complete the website setup, you need to add the following images to the `assets/` directory:

1. **app-preview.png** - A hero image showing the app (can be a mockup or screenshot)
2. **calendar-view.png** - Screenshot of the calendar feature
3. **expenses-view.png** - Screenshot of the expense tracking feature
4. **messages-view.png** - Screenshot of the messaging feature

You can export these from your app screenshots or create mockups.

### Recommended Image Sizes

- `logo.svg` - Already included (vector graphic)
- `app-preview.png` - 500-800px wide
- `calendar-view.png`, `expenses-view.png`, `messages-view.png` - 300-400px wide (mobile screenshot size)

### GitHub Pages Setup

1. Go to your repository settings
2. Navigate to "Pages" in the left sidebar
3. Under "Source", select the branch `claude/create-kopare-website-feyUj`
4. Click "Save"
5. Your site will be published at: `https://[username].github.io/kopare.app/`

## Local Development

To view the website locally:

1. Open `index.html` in your browser
2. Or use a simple HTTP server:
   ```bash
   python -m http.server 8000
   ```
   Then visit `http://localhost:8000`

## Technologies Used

- HTML5
- CSS3 (with CSS Grid and Flexbox)
- Responsive design for mobile, tablet, and desktop

## App Information

- **App Store**: https://apps.apple.com/us/app/kopare/id6749215322
- **Purpose**: Simplifying shared custody and family scheduling
