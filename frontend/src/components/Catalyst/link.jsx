/**
 * React Router integration for Catalyst UI Link component
 * Updated to work with React Router v6+
 */

import * as Headless from '@headlessui/react'
import React, { forwardRef } from 'react'
import { Link as RouterLink } from 'react-router-dom'

export const Link = forwardRef(function Link({ href, ...props }, ref) {
  // If href is provided, use React Router Link
  if (href) {
    return (
      <Headless.DataInteractive>
        <RouterLink to={href} {...props} ref={ref} />
      </Headless.DataInteractive>
    )
  }

  // Otherwise, use regular anchor tag
  return (
    <Headless.DataInteractive>
      <a {...props} ref={ref} />
    </Headless.DataInteractive>
  )
})
