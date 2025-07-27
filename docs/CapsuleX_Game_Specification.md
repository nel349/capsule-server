# CapsuleX Game Specification
## Product Requirements & User Experience Document

---

## 📋 **Document Overview**

**Purpose**: Define the game mechanics, user flows, and feature specifications for CapsuleX  
**Audience**: Product managers, designers, UX researchers, stakeholders  
**Scope**: User experience and game functionality (non-technical)  
**Version**: 1.0

---

## 🎮 **Game Concept**

### **Core Game Loop**
CapsuleX is a social guessing game built around **encrypted time capsules** that create engaging, shareable experiences with real digital rewards.

**The Magic**: Players create mysterious time capsules containing photos, videos, text, or audio, then post cryptic hints on social media. Others pay small fees to guess the contents, with winners earning points and collectible achievement NFTs.

### **Game Pillars**
1. **Nostalgia**: Time capsules tap into memories and emotional connection
2. **Mystery**: Encrypted contents create intrigue and curiosity  
3. **Social**: Built-in sharing mechanics drive viral growth
4. **Rewards**: Real digital assets (NFTs) provide lasting value
5. **Accessibility**: Simple mechanics anyone can understand

---

## 👥 **Player Types & Motivations**

### **🎨 Creators** (Capsule Makers)
**Who**: Users who enjoy creating content and engaging others  
**Motivations**:
- Express creativity through mysterious content
- Earn points and SOL from guessers
- Build following through engaging capsules
- Show off rare/valuable capsule collections

**Typical Behavior**:
- Create 2-5 capsules per week
- Focus on clever, challenging hints
- Share capsules across social platforms
- Monitor guess activity and engagement

### **🕵️ Guessers** (Players)
**Who**: Users who enjoy puzzles, games, and social interaction  
**Motivations**:
- Mental challenge and problem-solving satisfaction
- Social interaction with friends and creators
- Collect achievement badges and trophies
- Discover interesting content when capsules reveal

**Typical Behavior**:
- Guess on 5-15 capsules per day
- Follow favorite creators
- Share interesting capsules with friends
- Compete on leaderboards

### **📈 Collectors** (NFT Enthusiasts)
**Who**: Users focused on accumulating digital assets  
**Motivations**:
- Build valuable NFT collections
- Trade rare achievement badges
- Achieve milestone trophies
- Display social status through achievements

**Typical Behavior**:
- Strategic guessing to maximize badge collection
- Focus on rare/difficult capsules
- Trade NFTs on secondary markets
- Pursue specific trophy achievements

---

## 🗓️ **Game Flow Timeline**

### **Phase 1: Capsule Creation** (Day 0)
1. **Content Selection**: Creator chooses photo, video, text, or audio
2. **Encryption**: Content is encrypted and stored securely
3. **Hint Creation**: Creator writes cryptic clue for social media
4. **NFT Minting**: Capsule ownership NFT automatically created
5. **Social Sharing**: Hint posted to X (Twitter) with game link

### **Phase 2: Active Guessing** (Days 1-7)
1. **Discovery**: Players find capsules through social media or app
2. **Payment**: Players pay $0.25 fee to submit guess
3. **Validation**: AI system checks semantic similarity to answer
4. **Results**: Instant feedback on correct/incorrect guess
5. **Rewards**: Winners earn points, losers get participation points

### **Phase 3: Game Completion** (Day 7 or Earlier)
1. **Winner Declaration**: First correct guesser(s) declared winner
2. **Badge Eligibility**: Winners can mint achievement NFT ($1.00)
3. **Creator Rewards**: Creator earns 60% of all guess fees + points
4. **Leaderboard Update**: All player statistics updated

### **Phase 4: Capsule Reveal** (Day 7)
1. **Automatic Decryption**: Capsule content becomes visible
2. **Reveal Post**: Automatic social media post showing contents
3. **Viral Moment**: Shareable "big reveal" content created
4. **Trophy Check**: Players assessed for milestone achievements

---

## 🎯 **Detailed User Flows**

### **🎨 Creator Flow: Making a Capsule**

#### **Step 1: Content Upload**
- **Photo Capsule**: Upload image from camera roll or take new photo
- **Video Capsule**: Record short video (15-60 seconds) or upload existing
- **Text Capsule**: Write message, poem, story, or riddle
- **Audio Capsule**: Record voice message or upload audio file

**Content Guidelines**:
- Family-friendly content only
- No copyrighted material
- Maximum file sizes: 10MB photos, 50MB videos, 5MB audio
- Text limit: 500 characters

#### **Step 2: Capsule Configuration**
- **Answer Definition**: Set the exact answer players must guess
- **Difficulty Setting**: Choose Easy/Medium/Hard (affects point rewards)
- **Duration**: Select reveal timeline (1-7 days, default 7)
- **Audience**: Public (anyone can guess) or Private (invite-only)
- **Maximum Winners**: Set limit on how many can win (1-10, default 1)

#### **Step 3: Hint Creation**
- **Hint Text**: Write cryptic clue (280 character limit for Twitter)
- **Hint Type**: Choose from templates:
  - "Riddle Me This: [hint]"
  - "Guess What's Inside: [hint]" 
  - "Memory Lane Challenge: [hint]"
  - "Can You Solve: [hint]"
- **Emoji Support**: Add relevant emojis to enhance engagement
- **Preview**: See how hint will appear on social media

#### **Step 4: Monetization Setup**
- **Guess Fee**: Set custom fee ($0.10 - $1.00, default $0.25)
- **Creator Split**: Automatically set to 60% (platform takes 40%)
- **Revenue Estimate**: Preview potential earnings based on guess volume

#### **Step 5: Launch**
- **Final Review**: Confirm all settings before launch
- **Auto-Post**: Option to automatically post to connected social accounts
- **Manual Share**: Copy link to share manually across platforms
- **Track Performance**: Monitor guesses and engagement in real-time

### **🕵️ Guesser Flow: Playing the Game**

#### **Step 1: Discovery**
**Social Media Discovery**:
- See hint on X/Twitter with Solana Blink
- Click one-tap play button
- Redirected to game interface

**In-App Discovery**:
- Browse "Trending" capsules feed
- Search by creator or topic
- View "Friends" capsules from followed creators
- Explore "New" recently created capsules

#### **Step 2: Capsule Preview**
- **Hint Display**: See creator's cryptic clue
- **Metadata**: View difficulty, time remaining, current guesses
- **Creator Info**: See capsule maker's profile and stats
- **Cost Display**: Clear pricing before commitment ($0.25 default)
- **Previous Guesses**: Optionally view other players' attempts

#### **Step 3: Making a Guess**
- **Payment Confirmation**: One-tap payment authorization
- **Guess Input**: Type answer in text field (100 character limit)
- **Hint Review**: Reference original clue while typing
- **Confidence Check**: Optional "How sure are you?" rating
- **Submit**: Final confirmation before processing

#### **Step 4: Result Processing**
- **Instant Feedback**: Immediate correct/incorrect notification
- **Similarity Score**: See how close guess was (if incorrect)
- **Point Award**: Receive points for participation
- **Encouragement**: Motivational message for incorrect guesses
- **Victory Animation**: Special celebration for correct answers

#### **Step 5: Post-Guess Actions**
**If Correct**:
- **Badge Eligibility**: Option to mint winner NFT ($1.00)
- **Social Sharing**: Share victory on social media
- **Creator Follow**: Option to follow capsule creator
- **Similar Capsules**: Recommendations based on success

**If Incorrect**:
- **Try Again**: Option to make additional guess (pay again)
- **Give Up**: Exit gracefully with participation points
- **Learn More**: View hint explanations if available
- **Find Similar**: Discover capsules with similar themes

### **🏆 Achievement Flow: Collecting NFTs**

#### **Winner Badge Collection**
**Eligibility**: Successfully guess capsule contents  
**Trigger**: Automatic eligibility notification after win  
**Minting Process**:
1. **Badge Preview**: See unique design for specific capsule type
2. **Minting Fee**: Pay $1.00 to mint achievement NFT
3. **Customization**: Add personal note or timestamp
4. **Wallet Assignment**: NFT sent to connected wallet
5. **Social Proof**: Share achievement on social media

**Badge Categories**:
- **Quick Draw**: Win within first 5 guesses
- **Photo Detective**: Win photo-based capsules
- **Word Wizard**: Win text-based capsules  
- **Video Sleuth**: Win video-based capsules
- **Audio Ace**: Win audio-based capsules
- **Difficulty Master**: Win Hard difficulty capsules

#### **Trophy Milestone Collection**
**Automatic Eligibility**: Based on accumulated statistics  
**Trophy Types**:

**"First Winner" Trophy**:
- **Requirement**: Win your first capsule
- **Reward**: Commemorative milestone NFT
- **Cost**: $5.00 to mint
- **Significance**: Welcome to the winner's circle

**"Veteran Player" Trophy**:
- **Requirement**: Play 10+ capsules (win or lose)
- **Reward**: Participation milestone NFT
- **Cost**: $5.00 to mint
- **Significance**: Dedicated community member

**"Capsule Creator" Trophy**:
- **Requirement**: Create 5+ capsules
- **Reward**: Creator milestone NFT
- **Cost**: $5.00 to mint
- **Significance**: Content creator recognition

**"Champion Guesser" Trophy**:
- **Requirement**: Win 10+ capsules
- **Reward**: Elite achievement NFT
- **Cost**: $10.00 to mint (premium)
- **Significance**: Top-tier player status

---

## 🎲 **Game Mechanics**

### **Semantic Answer Validation**
**Innovation**: Natural language understanding instead of exact matching

**How It Works for Players**:
- Answer "car" matches "automobile" ✅
- Answer "pizza" matches "italian flatbread with cheese" ✅
- Answer "dog" doesn't match "cat" ❌
- Handles typos: "restarant" matches "restaurant" ✅
- Understands context: "Big Apple" matches "New York City" ✅

**Player Benefits**:
- No frustration from technicalities
- Natural language expression encouraged
- Creative answers accepted
- Focus on understanding, not memorization

### **Point System**
**Earning Points**:
- **Correct Guess**: 100 points + badge eligibility
- **Incorrect Guess**: 5 points (participation reward)
- **Create Capsule**: 50 points per guesser who participates
- **Daily Login**: 10 points (engagement bonus)
- **Social Share**: 25 points (viral growth incentive)

**Using Points**:
- **Leaderboard Ranking**: Monthly and all-time competitions
- **Free Guess Tokens**: 100 points = 1 free guess
- **Profile Customization**: Unlock themes, avatars, badges
- **Early Access**: Beta features for high-point players

### **Difficulty Levels**
**Easy Capsules** (Green):
- **Characteristics**: Straightforward hints, common answers
- **Point Multiplier**: 1x base points
- **Examples**: "Red fruit that keeps doctors away" → Apple
- **Target**: New players, casual engagement

**Medium Capsules** (Yellow):
- **Characteristics**: Moderate challenge, some lateral thinking
- **Point Multiplier**: 1.5x base points  
- **Examples**: "Home of the Bean and the Cod" → Boston
- **Target**: Regular players, balanced challenge

**Hard Capsules** (Red):
- **Characteristics**: Complex riddles, cultural references, wordplay
- **Point Multiplier**: 2x base points
- **Examples**: "The city that never sleeps in the Empire State" → New York
- **Target**: Expert players, maximum challenge

### **Social Features**
**Following System**:
- Follow favorite creators
- Get notifications for new capsules
- Priority in "Friends" feed
- Creator stats and achievements visible

**Commenting System**:
- Comment on revealed capsules
- React with emojis
- Share theories and explanations
- Build community discussions

**Leaderboards**:
- **Global Rankings**: Top players worldwide
- **Friend Rankings**: Compete with followed users
- **Creator Rankings**: Most engaging capsule makers
- **Monthly Competitions**: Seasonal challenges and prizes

---

## 📱 **User Interface Flows**

### **Home Screen Layout**
**Navigation Tabs**:
- **Discover**: Browse trending and new capsules
- **Friends**: Capsules from followed creators
- **Create**: Make new time capsule
- **Profile**: Personal stats, achievements, settings
- **Wallet**: Points, NFTs, transaction history

**Discover Feed Components**:
- **Featured Capsule**: Daily highlighted challenge
- **Trending Now**: Most active capsules
- **New Today**: Recently created capsules
- **Difficulty Filter**: Easy/Medium/Hard toggle
- **Search Bar**: Find specific creators or topics

### **Capsule Detail View**
**Information Display**:
- **Creator Profile**: Avatar, name, follower count
- **Hint Text**: Prominently displayed clue
- **Metadata Bar**: Difficulty, time remaining, guess count
- **Visual Indicator**: Content type icon (photo/video/text/audio)
- **Engagement Stats**: Views, shares, completion rate

**Action Buttons**:
- **Primary CTA**: "Guess for $0.25" (prominent button)
- **Secondary Actions**: Share, Save, Follow Creator
- **Info Button**: View rules and mechanics
- **Report Option**: Flag inappropriate content

### **Guess Submission Flow**
**Input Interface**:
- **Large Text Field**: Easy typing with autocomplete
- **Character Counter**: 100 character limit display
- **Hint Reference**: Always visible at top of screen
- **Confidence Slider**: Optional "How sure?" rating
- **Cost Reminder**: Clear fee display before submission

**Confirmation Modal**:
- **Guess Preview**: "You're guessing: [answer]"
- **Cost Confirmation**: "This will cost $0.25"
- **Payment Method**: Connected wallet or stored payment
- **Final Submit**: Large, clear confirmation button

### **Result Screen**
**Victory State**:
- **Celebration Animation**: Confetti and success sounds
- **Victory Message**: "Correct! You solved it!"
- **Points Earned**: "+100 points" with animation
- **Badge Opportunity**: "Mint your Winner Badge NFT"
- **Social Share**: Pre-composed victory post
- **Next Actions**: Find similar capsules, follow creator

**Incorrect State**:
- **Encouraging Message**: "Not quite, but close!"
- **Similarity Feedback**: "Your answer was 73% similar"
- **Points Earned**: "+5 participation points"
- **Try Again**: Option to make another guess
- **Hint Interpretation**: Optional explanation of clues

---

## 🎪 **Special Events & Seasonal Content**

### **Daily Challenges**
**Format**: Featured capsule with special rewards  
**Themes**: Rotate through categories (movies, music, history, etc.)  
**Bonuses**: Double points, exclusive badge designs  
**Duration**: 24-hour availability window  

### **Creator Spotlights**
**Weekly Feature**: Highlight top creators and their best capsules  
**Benefits**: Increased visibility, follower growth, bonus rewards  
**Selection**: Based on engagement, creativity, community voting  

### **Holiday Events**
**Seasonal Themes**: Christmas, Halloween, Valentine's Day, etc.  
**Special Content**: Holiday-themed capsules and achievements  
**Limited Editions**: Rare trophy NFTs only available during events  
**Community Challenges**: Collaborative goals and group rewards  

### **Tournament Mode**
**Format**: Bracket-style elimination competitions  
**Entry**: Free with points or small SOL fee  
**Prizes**: Exclusive NFTs, point bonuses, recognition  
**Frequency**: Monthly tournaments with different themes  

---

## 🛡️ **Safety & Moderation**

### **Content Guidelines**
**Allowed Content**:
- Personal photos and memories
- Creative riddles and wordplay
- Educational content
- Pop culture references
- Original audio and video

**Prohibited Content**:
- Inappropriate or explicit material
- Copyrighted content without permission
- Hateful or discriminatory content
- Personal information of others
- Spam or promotional content

### **Moderation System**
**Automated Screening**:
- AI content analysis for inappropriate material
- Keyword filtering for prohibited terms
- Image recognition for explicit content
- Audio analysis for inappropriate speech

**Community Reporting**:
- Easy reporting buttons on all content
- Multiple report categories (spam, inappropriate, etc.)
- Community voting on borderline cases
- Transparent moderation decisions

**Creator Verification**:
- Optional verification badges for trusted creators
- Requirements: Consistent quality, community standing
- Benefits: Higher visibility, trust indicators
- Responsibilities: Model behavior, community leadership

---

## 📊 **Analytics & Feedback**

### **Player Progress Tracking**
**Personal Statistics**:
- Total capsules guessed
- Win/loss ratio and streak
- Points earned and current balance
- Favorite content categories
- Time spent playing

**Achievement Progress**:
- Progress toward trophy milestones
- Badge collection completeness
- Rarity scores for NFT collection
- Leaderboard position tracking

### **Creator Analytics**
**Capsule Performance**:
- Number of guesses received
- Average time to solve
- Engagement rate and shares
- Revenue generated
- Difficulty rating accuracy

**Audience Insights**:
- Follower growth over time
- Most popular content types
- Geographic distribution of players
- Repeat guesser identification

### **Community Feedback**
**Rating System**:
- Post-reveal capsule ratings
- Creator quality feedback
- Hint clarity assessments
- Overall game experience reviews

**Improvement Suggestions**:
- In-app feedback forms
- Feature request voting
- Community discussions
- Beta testing participation

---

## 🚀 **Growth & Retention Features**

### **Onboarding Experience**
**Tutorial Flow**:
1. **Welcome**: Brief explanation of time capsule concept
2. **Sample Guess**: Try solving a demo capsule (free)
3. **First Creation**: Guided capsule creation process
4. **Social Setup**: Connect social accounts for sharing
5. **Achievement Explanation**: How NFTs and points work

**Progressive Disclosure**:
- Start with basic guessing functionality
- Gradually introduce advanced features
- Unlock creation tools after playing several capsules
- Advanced analytics available to engaged users

### **Retention Mechanics**
**Daily Engagement**:
- Daily login bonuses
- Fresh content notifications
- Streak tracking and rewards
- Time-sensitive challenges

**Social Bonds**:
- Friend activity feeds
- Group challenges and competitions
- Creator-follower relationships
- Community leaderboards

**Collection Completionism**:
- Badge series and sets
- Trophy milestone progression
- Rare achievement hunting
- Trading and marketplace features

### **Viral Growth Features**
**Built-in Sharing**:
- One-tap social media posting
- Pre-composed engaging messages
- Visual assets for each capsule type
- Success story amplification

**Referral System**:
- Invite friends for bonus points
- Special badges for successful referrals
- Creator collaboration incentives
- Community building rewards

---

## 📈 **Success Metrics**

### **Player Engagement**
- **Daily Active Users (DAU)**: Target 20% of monthly users
- **Session Length**: Target 15+ minutes average
- **Retention Rates**: 40% Day-7, 20% Day-30
- **Viral Coefficient**: 1.2+ organic growth rate

### **Content Quality**
- **Capsule Completion Rate**: 60%+ of started capsules solved
- **Creator Return Rate**: 70%+ create multiple capsules
- **Average Guesses per Capsule**: 8-12 optimal range
- **User Rating**: 4.5+ stars average capsule quality

### **Economic Health**
- **Revenue per User**: $32+ annually
- **NFT Minting Rate**: 25%+ of eligible players mint
- **Creator Earnings**: $50+ average per successful capsule
- **Payment Conversion**: 90%+ successful payment processing

---

This game specification document provides a comprehensive overview of CapsuleX from a user experience perspective, focusing on the game mechanics, user flows, and features that make it engaging and viral. The document serves as a product roadmap for development teams and stakeholders to understand what the final product should deliver to users.

---

**CapsuleX**: *Where Every Memory Becomes a Game, Every Game Becomes an NFT, and Every NFT Tells a Story.* 