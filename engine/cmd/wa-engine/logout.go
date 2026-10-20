package main

// logout connects first: whatsmeow's Logout sends on whatever socket there is, and with none it fails before anything
// leaves, which a write reports as "may have gone through". Connecting also hears WhatsApp say it dropped the device.
func (e *engine) logout() error {
	if err := e.connect(); err != nil {
		return err
	}
	return e.client.Logout(e.ctx)
}
