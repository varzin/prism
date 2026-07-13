import React from 'react'
import {Link} from 'react-router-dom'
import {routePrefix} from '../constants'

export function NotFound() {
  return (
    <div style={{padding: 16}}>
      <p style={{marginTop: 0}}>Page not found</p>
      <Link to={`${routePrefix}/`}>Go home</Link>
    </div>
  )
}
