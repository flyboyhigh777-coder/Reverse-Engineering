# kotlinx.serialization keeps the generated serializers next to the classes they serialize; R8
# cannot see that link, so the annotated classes and their companions have to be kept explicitly.
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**

-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    static <1>$Companion Companion;
}
-if @kotlinx.serialization.Serializable class ** {
    static **$* *;
}
-keepclassmembers class <2>$<3> {
    kotlinx.serialization.KSerializer serializer(...);
}
-if @kotlinx.serialization.Serializable class **
-keepclassmembers class <1> {
    *** Companion;
}

# The engine reports failures by their message; keeping the names makes a crash report readable.
-keepnames class io.github.flyboyhigh777.speedmeter.engine.** { *; }
