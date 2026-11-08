package io.github.flyboyhigh777.speedmeter

import android.app.Application

/**
 * Nothing to wire at startup.
 *
 * The repositories are cheap to construct and are owned by the view model, so there is no graph to
 * build here; the class exists only to give the manifest a stable name should that change.
 */
class SpeedMeterApplication : Application()
