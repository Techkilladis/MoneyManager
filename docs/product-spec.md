# Money Manager - Product Specification

## Overview
Privacy-first personal finance application focused on automatically capturing UPI transactions on Android.

## Core User Flow
1. User makes UPI payment using Google Pay, PhonePe, Paytm, BHIM, or other UPI apps
2. Android receives UPI payment notification
3. Native NotificationListenerService detects notification
4. Native parser extracts: amount, merchant, UPI app, timestamp, transaction reference, raw notification
5. Transaction stored locally as pending/unclassified
6. Quick Capture flow asks "What was this for?"
7. User chooses category, assigns member, adds note, edits merchant, confirms amount
8. Transaction becomes part of financial history

## Core Principles
- **Local-First**: No cloud backend for MVP
- **Privacy-First**: Financial data stays local
- **Financial Data Correctness**: Integer paise for money, explicit state models

## MVP Requirements
- Expo SDK 52, React Native 0.76, React 18.3, TypeScript
- Android-first, Expo Development Build
- SQLite local database (Expo SQLite)
- NotificationListenerService for UPI detection
- Categories, members, merchants, budgets, analytics
- Quick Capture for transaction classification
- Git repository with documentation

## Technical Constraints
- NO Expo SDK 53+
- NO React Native 0.77+
- NO old bare RN 0.87 project reuse
- NO AccessibilityService as primary UPI detector
- NO SMS permission as core mechanism
- Money stored as integer paise (₹125.50 = 12550)