import { render } from 'preact'
import './index.css'
import { App } from './app'

const container = document.getElementById('app');
if (container) {
  render(<App />, container)
}
